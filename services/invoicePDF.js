// services/invoicePDF.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { renderInvoiceHTML, toDataUri } = require('./invoiceTemplate');

async function printHtmlToPdfBuffer(html) {
  let browser;
  try {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PUPPETEER_EXECUTABLE_PATH
    ].filter(Boolean);

    let executablePath;
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) { executablePath = chromePath; break; }
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.emulateMediaType('screen');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' }
    });
  } finally {
    if (browser) await browser.close();
  }
}

// Used by “Bill Job”
async function generateInvoicePdfFromWorkOrder(workOrder, manualAmount, invoiceData = {}) {
  const assets = { logo: toDataUri(path.resolve(__dirname, '../public/TBSPDF7.png')) };
  const html = renderInvoiceHTML(workOrder, manualAmount, assets, invoiceData);
  const buf = await printHtmlToPdfBuffer(html);
  // (optional) save a temp copy
  try {
    const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');
    const datePart = workOrder.basic?.dateOfJob || new Date().toISOString().slice(0,10);
    fs.writeFileSync(path.join(os.tmpdir(), `invoice-${safeClient}-${datePart}.pdf`), buf);
  } catch {}
  return buf;
}

// Used by Interest Bot (works off Invoice + computed “due” + job info)
async function generateInvoicePdfFromInvoice(inv, due, job = {}) {
  // shape the template inputs to look like “workOrder-ish”
  const workOrderShim = {
    basic: {
      client: inv.company,
      project: job.project || '',
      address: job.address || '',
      city: job.city || '',
      state: job.state || '',
      zip: job.zip || '',
      dateOfJob: inv.sentAt ? new Date(inv.sentAt).toISOString().slice(0,10) : ''
    },
    _id: inv._id
  };

  // build service rows showing principal + interest
  const invoiceData = {
    invoiceDate: new Date().toISOString().slice(0,10),
    invoiceNumber: inv._id.toString().slice(-6),
    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0,10) : undefined,
    billToCompany: inv.company,
    billToAddress: job.billingAddress || '',
    sheetRows: [
      { service: 'Principal', taxed: false, amount: Number(due.principal || inv.principal || 0) },
      { service: `Interest (2.5% simple × ${Number(due.steps || 0)})`, taxed: false, amount: Number(due.interest || 0) }
    ],
    sheetSubtotal: Number((due.principal || 0) + (due.interest || 0)),
    sheetTaxRate: 0,
    sheetTaxDue: 0,
    sheetOther: 0,
    sheetTotal: Number(due.total || 0),
    workType: job.workType,
    foreman: job.foreman,
    location: job.location,

    // if you also want to use the explicit late row in the template:
    lateInterest: Number(due.interest || 0),
    lateSteps: Number(due.steps || 0)
  };

  const assets = { logo: toDataUri(path.resolve(__dirname, '../public/TBSPDF7.png')) };
  const html = renderInvoiceHTML(workOrderShim, invoiceData.sheetTotal, assets, invoiceData);
  // Return a Buffer (nodemailer handles Buffers well)
  return await printHtmlToPdfBuffer(html);
}

module.exports = {
  generateInvoicePdfFromWorkOrder,
  generateInvoicePdfFromInvoice
};

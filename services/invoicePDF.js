// services/invoicePdf.js  (kept separate from routes/billing.js helpers)
const { renderInvoiceHTML } = require('../routes/billing'); // or move renderInvoiceHTML into this file
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

function toDataUri(absPath) { /* same as your helper */ }

async function generateInvoicePdfFromInvoice(inv, due, job = {}) {
  // Build a tiny “invoiceData” object so the template can show the interest
  const invoiceData = {
    invoiceDate: new Date().toISOString().slice(0,10),
    invoiceNumber: inv._id.toString().slice(-6),
    dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0,10) : undefined,
    billToCompany: inv.company,
    billToAddress: job.billingAddress || '',
    // Use the 3-number block your emails mention
    sheetRows: [
      { service: 'Principal', taxed: false, amount: Number(due.principal || inv.principal || 0) },
      { service: `Interest (2.5% simple × ${due.steps} step${due.steps === 1 ? '' : 's'})`, taxed: false, amount: Number(due.interest || 0) },
    ],
    sheetSubtotal: Number((due.principal || 0) + (due.interest || 0)),
    sheetTaxRate: 0,
    sheetTaxDue: 0,
    sheetOther: 0,
    sheetTotal: Number(due.total || 0),
    workType: job.workType,
    foreman: job.foreman,
    location: job.location,
  };

  const assets = { logo: toDataUri(path.resolve(__dirname, '../public/TBSPDF7.png')) };
  // Reuse your HTML template (it expects “workOrder-ish” fields; pass a shim)
  const workOrderShim = {
    basic: {
      client: inv.company,
      project: job.project || '',
      address: job.address || '',
      city: job.city || '',
      state: job.state || '',
      zip: job.zip || '',
      dateOfJob: inv.sentAt ? new Date(inv.sentAt).toISOString().slice(0,10) : '',
    },
    _id: inv._id,
  };

  const html = renderInvoiceHTML(workOrderShim, invoiceData.sheetTotal, assets, invoiceData);

  // Standard puppeteer printing (same as your other function)
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.emulateMediaType('screen');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' }
    });

    // (Optional) Save a temp copy for quick manual checks
    const tmpFile = path.join(os.tmpdir(), `invoice-with-interest-${inv._id}.pdf`);
    fs.writeFileSync(tmpFile, pdfBuffer);

    return tmpFile; // interestBot expects a path (it uses nodemailer "path")
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generateInvoicePdf: generateInvoicePdfFromInvoice };

// services/invoicePDF.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { renderV42Document, loadStdAssets } = require('./v42Base');

/* ---------- shared PDF printer ---------- */
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

/* ---------- helpers ---------- */
function money(n){ return `$${Number(n||0).toFixed(2)}`; }

/* 3-column service line items (SERVICE | TAXED | AMOUNT) */
function serviceLineItemsHTML(rows) {
  const body = (rows?.length ? rows : []).map(r => `
    <tr>
      <td>${r.service}</td>
      <td style="text-align:center; width:90px;">${r.taxed ? 'X' : ''}</td>
      <td style="text-align:right; width:160px;">${money(r.amount)}</td>
    </tr>`).join('') || `
    <tr><td colspan="3" style="text-align:center;font-style:italic;">No services listed</td></tr>`;

  return `
  <table class="table">
    <thead>
      <tr>
        <th>SERVICE</th>
        <th style="text-align:center; width:90px;">TAXED</th>
        <th style="text-align:right; width:160px;">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

/* One-column notes list INSIDE the Services section */
function serviceNotesOneColHTML() {
  return `
  <table class="onecol-table">
    <tbody>
      <tr>
        <td>
          <ul class="dotlist">
            <li>Per Secondary Street Intersections/Closing signs: $25.00</li>
            <li>Signs and additional equipment left after hours: $- per/sign</li>
            <li>Arrow Board $- ( Used ) &nbsp; Message Board $- ( )</li>
            <li>Mobilization: If applicable: 25 miles from TBS's building • $0.82/mile/vehicle (–)</li>
            <li>All quotes based off a "TBS HR" – hour day, anything over 8 hours will be billed at $-/hr per crew member. CREWS OF ____ WORKED ____ HRS OT</li>
            <li>TBS HOURS: ____ AM – ____ PM</li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>`;
}

/* Whole Services section (navy heading + 3-col + one-col notes) */
function servicesSectionHTML(rows) {
  return `
    <div class="section-title">SERVICE</div>
    ${serviceLineItemsHTML(rows)}
    ${serviceNotesOneColHTML()}
  `;
}

/* Fully Loaded Vehicle as its own section (navy heading + one column) */
function fullyLoadedVehicleSectionHTML() {
  return `
    <div class="section-title">FULLY LOADED VEHICLE</div>
    <table class="onecol-table">
      <tbody>
        <tr>
          <td>
            <ul class="dotlist">
              <li>8 to 10 signs for flagging and lane operations.</li>
              <li>2 STOP &amp; GO paddles &nbsp;&nbsp; 2 Certified Flaggers &amp; Vehicle with Strobes.</li>
              <li>30 Cones &amp; 2 Barricades.</li>
              <li>Arrow Board upon request: additional fees will be applied.</li>
              <li>Late payment fee will go into effect if payment is not by due date after receiving invoice.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

/* Totals block (no collisions with “late” version) */
function totalsBlock({subtotal, taxRate, taxDue, other, total}) {
  return `
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    ${taxDue > 0 ? `<div class="row"><span>Tax (${Number(taxRate||0)}%)</span><span>${money(taxDue)}</span></div>` : ''}
    ${(Number.isFinite(other) && other !== 0) ? `<div class="row"><span>Other</span><span>${money(other)}</span></div>` : ''}
    <div class="row grand"><span>TOTAL</span><span>${money(total)}</span></div>
  </div>`;
}

/* optional footer (kept minimal since FLV moved to its own section) */
function footerBlock() {
  return `
    <div style="margin-top:10px;"><strong>Make all checks payable to TBS</strong></div>
    <div style="margin-top:10px;">If you have any questions about this invoice, please contact<br/>[Bryson Davis, 706-263-0715, tbsolutions3@gmail.com]</div>
    <div style="margin-top:10px; font-weight:bold;">Thank You For Your Business!</div>`;
}

/* ---------- MAIN: build invoice from work order ---------- */
async function generateInvoicePdfFromWorkOrder(workOrder, /* number */manualAmount, invoiceData = {}) {
  const { logo, cone } = loadStdAssets();

  const html = renderV42Document({
    title: 'INVOICE',
    coneDataUri: cone,
    logoDataUri: logo,
    companyBox: {
      client: workOrder?.basic?.client,
      address: workOrder?.basic?.address,
      city: workOrder?.basic?.city,
      state: workOrder?.basic?.state,
      zip: workOrder?.basic?.zip,
    },
    metaBox: {
      date: invoiceData.invoiceDate || new Date().toLocaleDateString(),
      invoiceNo: invoiceData.invoiceNumber || String(workOrder?._id || 'INV001').slice(-6),
      wr1: invoiceData.workRequestNumber1,
      wr2: invoiceData.workRequestNumber2,
      dueDate: invoiceData.dueDate
    },
    billTo: {
      company: invoiceData.billToCompany || workOrder?.basic?.client,
      address: invoiceData.billToAddress,
      workType: invoiceData.workType,
      foreman: invoiceData.foreman,
      location: invoiceData.location
    },
    contentHTML: [
      servicesSectionHTML(invoiceData.sheetRows || []),
      fullyLoadedVehicleSectionHTML(),
    ].join(''),
    totalsHTML: totalsBlock({
      subtotal: invoiceData.sheetSubtotal ?? manualAmount ?? 0,
      taxRate:  invoiceData.sheetTaxRate  ?? 0,
      taxDue:   invoiceData.sheetTaxDue   ?? 0,
      other:    invoiceData.sheetOther    ?? 0,
      total:    invoiceData.sheetTotal    ?? manualAmount ?? 0
    }),
    footerHTML: footerBlock()
  });

  // tag & print
  const htmlWithMarker = html.replace('<body>', '<body><!-- v42base:1 -->');
  const buf = await printHtmlToPdfBuffer(htmlWithMarker);

  // (optional) save a temp copy
  try {
    const safeClient = (workOrder?.basic?.client || 'client').replace(/[^a-z0-9]+/gi,'-');
    const datePart = workOrder?.basic?.dateOfJob || new Date().toISOString().slice(0,10);
    fs.writeFileSync(path.join(os.tmpdir(), `invoice-${safeClient}-${datePart}.pdf`), buf);
  } catch {}
  return buf;
}

/* ---------- LATE/INTEREST invoice (interest bot) ---------- */
function lateContentHTML({ rows }) {
  const body = rows.map(r => `
    <tr>
      <td>${r.service}</td>
      <td style="text-align:center; width:90px;">${r.taxed ? 'X' : ''}</td>
      <td style="text-align:right; width:160px;">${money(r.amount)}</td>
    </tr>`).join('');

  return `
    <table class="table">
      <thead>
        <tr>
          <th>SERVICE</th>
          <th style="text-align:center; width:90px;">TAXED</th>
          <th style="text-align:right; width:160px;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function lateTotalsBlock({principal, interest, total}) {
  return `
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(principal + interest)}</span></div>
    <div class="row grand"><span>TOTAL</span><span>${money(total)}</span></div>
  </div>`;
}

async function generateInvoicePdfFromInvoice(inv, due, job = {}) {
  const { logo, cone } = loadStdAssets();

  const rows = [
    { service: 'Principal', taxed: false, amount: Number(due.principal || inv.principal || 0) },
    { service: `Interest (2.5% simple × ${Number(due.steps||0)})`, taxed: false, amount: Number(due.interest || 0) }
  ];

  const html = renderV42Document({
    title: 'INVOICE',
    coneDataUri: cone,
    logoDataUri: logo,
    companyBox: {
      client: inv.company,
      address: job.address, city: job.city, state: job.state, zip: job.zip
    },
    metaBox: {
      date: new Date().toLocaleDateString(),
      invoiceNo: String(inv._id).slice(-6),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : ''
    },
    billTo: {
      company: inv.company,
      address: job.billingAddress || '',
      workType: job.workType,
      foreman: job.foreman,
      location: job.location
    },
    contentHTML: lateContentHTML({ rows }),
    totalsHTML: lateTotalsBlock({
      principal: Number(due.principal||0),
      interest: Number(due.interest||0),
      total: Number(due.total||0)
    }),
    footerHTML: `
      <div>Please call <strong>Leah Davis</strong> for payment: <strong>(706) 913-3317</strong></div>
      <div style="margin-top:10px; font-weight:bold;">Thank You For Your Business!</div>`
  });

  return await printHtmlToPdfBuffer(html);
}

module.exports = {
  generateInvoicePdfFromWorkOrder,
  generateInvoicePdfFromInvoice,
  printHtmlToPdfBuffer
};

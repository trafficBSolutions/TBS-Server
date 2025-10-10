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
    console.log('[pdf] Starting PDF generation...');
    
    // Robust executable path resolution
    const candidates = [];

    try {
      const p = await puppeteer.executablePath(); // works when bundled Chromium is available
      if (p) candidates.push(p);
    } catch (_) {}

    // Common Linux paths
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );

    // Windows paths
    candidates.push(
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe'
    );

    // Env override last (if you set it)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      candidates.unshift(process.env.PUPPETEER_EXECUTABLE_PATH);
    }

    let executablePath = undefined;
    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) { executablePath = p; break; }
      } catch (_) {}
    }

    console.log('[pdf] using executablePath:', executablePath || '(bundled/default)');

    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    console.log('[pdf] Browser launched successfully');
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });

    console.log('[pdf] Setting page content...');
    // Be more forgiving than 'networkidle0' to avoid hangs
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.emulateMediaType('screen');

    console.log('[pdf] Generating PDF...');
    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' }
    });

    if (!buf || !buf.length) {
      throw new Error('Empty PDF buffer');
    }
    
    console.log('[pdf] PDF generated successfully, size:', buf.length, 'bytes');
    return buf;
  } catch (error) {
    console.error('[pdf] PDF generation failed:', error);
    throw error;
  } finally {
    if (browser) {
      try { 
        await browser.close(); 
        console.log('[pdf] Browser closed');
      } catch (e) {
        console.error('[pdf] Error closing browser:', e);
      }
    }
  }
}


/* ---------- helpers ---------- */
function money(n){ return `$${Number(n||0).toFixed(2)}`; }

function servicesSectionFromRowsHTML(rows, invoiceData) {
  return [
    serviceLineItemsHTML(rows),          // the 3-column SERVICES table
    serviceNotesOneColHTML(invoiceData), // the one-column notes list (same as main invoice)
  ].join('');
}
/* 3-column service line items (SERVICE | TAXED | AMOUNT) */
 function serviceLineItemsHTML(rows) {
  const billable = (rows || []).filter(r => Number(r?.amount) > 0);
  const body = (billable.length ? billable : []).map(r => `
    <tr>
      <td>${r.service}</td>
      <td style="text-align:center; width:90px;">${r.taxed ? 'X' : ''}</td>
      <td style="text-align:right; width:160px;">${money(r.amount)}</td>
    </tr>`).join('') || `
    <tr><td colspan="3" style="text-align:center;font-style:italic;">No billable services</td></tr>`;

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
 function serviceNotesOneColHTML(invoiceData = {}, fallbackMileRate = 0.82) {
  // Pull values the same way your React editor does
  const rows = Array.isArray(invoiceData.sheetRows) ? invoiceData.sheetRows : [];
  const findRow = (needle) =>
    rows.find(r => (r.service || '').toLowerCase().includes(needle));

  const intersections = findRow('intersection');         // e.g. “Secondary intersections/closing signs”
  const afterHours    = findRow('after-hours');          // “after-hours signs”
  const arrowBoard    = findRow('arrow board');
  const messageBoard  = findRow('message board');
  const mobilization  = findRow('mobilization');

  const intersectionsPer = Number(intersections?.amount) || 0;
  const afterHoursPer    = Number(afterHours?.amount)    || 0;
  const arrowAmt         = Number(arrowBoard?.amount)    || 0;
  const messageAmt       = Number(messageBoard?.amount)  || 0;
  const mobilizationAmt  = Number(mobilization?.amount)  || 0; // this could be a line total if you keyed it that way

  const crewsCount = invoiceData.crewsCount ?? '';
  const otHours    = invoiceData.otHours ?? '';
  const tbsHours   = invoiceData.tbsHours ?? '';
  
  return `
  <table class="onecol-table">
    <tbody>
      <tr>
        <td>
          <ul class="dotlist">
            <li>Per Secondary Street Intersections/Closing signs: ${intersectionsPer > 0 ? money(intersectionsPer) : '$-'}</li>
            <li>Signs and additional equipment left after hours: ${afterHoursPer > 0 ? money(afterHoursPer) + ' per/sign' : '$- per/sign'}</li>
            <li>Arrow Board ${arrowAmt > 0 ? money(arrowAmt) : '$-'} (${arrowAmt > 0 ? 'Used' : '—'})
                &nbsp; Message Board ${messageAmt > 0 ? money(messageAmt) : '$-'} (${messageAmt > 0 ? 'Used' : '—'})</li>
            <li>Mobilization: If applicable: 25 miles from TBS's building • ${mobilizationAmt > 0 ? money(mobilizationAmt) + ' total' : money(fallbackMileRate) + '/mile/vehicle (–)'}</li>
            <li>All quotes based off a "TBS HR" – hour day, anything over 8 hours will be billed at $-/hr per crew member.
                CREWS OF ${crewsCount || '____'} WORKED ${otHours || '____'} HRS OT</li>
            <li>TBS HOURS: ${tbsHours || '____ AM – ____ PM'}</li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>`;
}

/* Whole Services section (navy heading + 3-col + one-col notes) */
function servicesSectionHTML(invoiceData = {}) {
  const rows = Array.isArray(invoiceData.sheetRows) ? [...invoiceData.sheetRows] : [];
  const crews = Number(invoiceData.crewsCount) || 0;
  const hrs   = Number(invoiceData.otHours) || 0;
  const rate  = Number(invoiceData.otRate) || 0;
  const otTot = Number(invoiceData.otLaborTotal) || 0;

  if (otTot > 0) {
    rows.push({
      service: `Overtime labor — ${crews} crew × ${hrs} hr × $${rate.toFixed(2)}/hr`,
      taxed: false,
      amount: otTot
    });
  }

  return `
    ${serviceLineItemsHTML(rows)}
    ${serviceNotesOneColHTML(invoiceData)}
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
async function generateInvoicePdfFromWorkOrder(workOrder, manualAmount, invoiceData = {}) {
  const { logo, cone } = loadStdAssets();

  // derive the correct invoice number for the FIRST email
  const invoiceNo =
    invoiceData?.invoiceNumber ||
    (workOrder?._id ? String(workOrder._id).slice(-6) : 'INV001');

  const html = renderV42Document({
    title: 'INVOICE',
    coneDataUri: cone,
    logoDataUri: logo,

    companyBox: {
      client: workOrder?.basic?.client,
      address: workOrder?.basic?.address,
      city:    workOrder?.basic?.city,
      state:   workOrder?.basic?.state,
      zip:     workOrder?.basic?.zip,
    },

    metaBox: {
      date:      invoiceData.invoiceDate || new Date().toLocaleDateString(),
      invoiceNo: invoiceNo,
      wr1:       invoiceData?.workRequestNumber1,
      wr2:       invoiceData?.workRequestNumber2,
      dueDate:   invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : ''
    },

    billTo: {
      company: invoiceData.billToCompany || workOrder?.basic?.client,
      address: invoiceData.billToAddress,
      workType: invoiceData.workType,
      foreman:  invoiceData.foreman,
      location: invoiceData.location
    },

    contentHTML: [
      servicesSectionHTML(invoiceData),    // already filters out $0.00 lines
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

  // 1) Original, non-zero service rows from the saved invoice data
 const originalRows = (
   inv.invoiceData?.sheetRows ||
   (inv.lineItems || []).map(li => ({
     service: li.description,
     taxed: false,                 // no tax column stored; keep false
     amount: Number(li.total ?? li.unitPrice ?? 0)
   }))
 ).filter(r => Number(r?.amount) > 0);
  // 2) Append an Interest line if applicable (non-taxed)
  const rows = [...originalRows];
  const interestAmt = Number(due.interest || 0);
  if (interestAmt > 0) {
    rows.push({
      service: `Interest (2.5% simple × ${Number(due.steps || 0)} steps)`,
      taxed: false,
      amount: interestAmt
    });
  }

  // 3) Compute totals the same way your main invoice block renders
  const principal = Number(due.principal || 0);
  const total     = Number(due.total || (principal + interestAmt));
const invoiceNo =
  inv.invoiceNumber ||
  inv.invoiceData?.invoiceNumber ||
  job?.invoiceData?.invoiceNumber ||
  String(inv._id).slice(-6);
  // 4) Billing address logic (same as you had, but preserved)
  const BILLING_ADDRESSES = {
    'Atlanta Gas Light': '600 Townpark Ln, Kennesaw, GA 30144',
    'Broadband of Indiana': '145 Peppers Dr, Paris, TN 38242',
    'Broadband Technical Resources': '6 Francis St, Chattanooga, TN 37419',
    'Desoto': '4705 S Apopka Vineland Rd ste 130, Orlando, FL 32819',
    'Fairway Electric': '7138 Keegan Ct, Covington GA 30014',
    'Global Infrastructure': 'PO Box 22756, Chattanooga, TN 37422',
    'HD Excavations & Utilities LLC': '516 Cole Creek Rd, Dallas, GA 30157',
    'Hibbymo Properties-Cloudland': '443 Elm St, Calhoun, GA, 30701',
    'H and H Paving and Concrete': '8473 Earl D Lee Blvd Suite 300 Douglasville, GA 30134',
    'J and A Grading': '341 Liberty Dr, Dalton, GA 30721',
    'Magnum Paving LLC': '140 Baker Industrial Court, Villa Rica, GA 30180',
    'Perman Construction': '2425 Lumbley Rd, Rainbow City, AL 35906',
    'Pike Electric Corporation': '905 White Cir Ct NW, Marietta, GA 30060',
    'Service Electric': '1631 E 25th St, Chattanooga, TN 37404',
    'Source One': '5067 Bristol Industrial Way Suite D, Buford, GA 30518',
    'The Surface Masters': '1393 Cobb Industrial Way, Marietta, GA 30066',
    'Tindall Corporation': '3361 Grant Rd, Conley, GA 30288',
    'Wilson Boys Enterprises, LLC': '8373 Earl D Lee Blvd STE 300, Douglasville, GA 30134'
  };

  const billingAddress =
    inv.invoiceData?.billToAddress ||
    job.invoiceData?.billToAddress ||
    BILLING_ADDRESSES[inv.company] ||
    '';

  // 5) Render using the SAME v42 frame + blocks as the main invoice
  const html = renderV42Document({
    title: 'INVOICE REMINDER',
    coneDataUri: cone,
    logoDataUri: logo,

    // Left company/job box (same shape as main invoice)
    companyBox: {
      client: inv.company,
      address: job?.basic?.address || job?.address || inv.invoiceData?.location || '',
      city:    job?.basic?.city    || job?.city    || '',
      state:   job?.basic?.state   || job?.state   || '',
      zip:     job?.basic?.zip     || job?.zip     || ''
    },

    // Right meta box (same as main invoice)
    metaBox: {
      date: new Date().toLocaleDateString(),
      invoiceNo: invoiceNo,
      wr1: inv.invoiceData?.workRequestNumber1 || job?.invoiceData?.workRequestNumber1 || inv.workRequestNumber1 || job?.workRequestNumber1,
      wr2: inv.invoiceData?.workRequestNumber2 || job?.invoiceData?.workRequestNumber2 || inv.workRequestNumber2 || job?.workRequestNumber2,
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : ''
    },

    // Bill To block (same as main invoice)
    billTo: {
      company: inv.invoiceData?.billToCompany || job?.invoiceData?.billToCompany || inv.company,
      address: normalize(billingAddress),
      workType: inv.invoiceData?.workType || job?.invoiceData?.workType || job?.workType,
      foreman: inv.invoiceData?.foreman || job?.invoiceData?.foreman || job?.foreman,
      location: inv.invoiceData?.location || job?.invoiceData?.location || job?.location
    },

    // Services table + notes, using the shared components
    contentHTML: servicesSectionHTML(inv.invoiceData || { sheetRows: rows }),

    // Totals shown with "Other" == interest, no tax
    totalsHTML: totalsBlock({
      subtotal: principal,      // original services total (principal)
      taxRate:  0,
      taxDue:   0,
      other:    interestAmt,    // interest shown as its own row
      total:    total           // principal + interest
    }),

    // Footer—kept minimal like your reminder
    footerHTML: `
      <div>Please call <strong>Leah Davis</strong> for payment: <strong>(706) 913-3317</strong></div>
      <div style="margin-top:10px; font-weight:bold;">Thank You For Your Business!</div>`
  });

  // Keep the shared printer & margins
  return await printHtmlToPdfBuffer(html);
}

// Helper function to normalize address strings
function normalize(str) {
  return (str || '').trim();
}

module.exports = {
  generateInvoicePdfFromWorkOrder,
  generateInvoicePdfFromInvoice,
  printHtmlToPdfBuffer
};

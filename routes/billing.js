// routes/billing.js
 const express = require('express');
 const router = express.Router();
 const cors = require('cors');
 const Invoice = require('../models/invoice');
 const ControlUser = require('../models/controluser');
 const auth = require('../middleware/auth');
const requireInvoiceAdmin = require('../middleware/requireInvoiceAdmin');
 const { generateWorkOrderPdf } = require('../services/workOrderPDF');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function toDataUri(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      console.warn(`File not found: ${absPath}`);
      return '';
    }
    const ext = path.extname(absPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
    const buf = fs.readFileSync(absPath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error(`Failed to read file ${absPath}:`, e.message);
    return '';
  }
}

function renderInvoiceHTML(workOrder, manualAmount, assets, invoiceData = {}) {
  const formatCurrency = (amount) => `$${Number(amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  
  const serviceRows = invoiceData.sheetRows || [];
  const serviceRowsHTML = serviceRows.map(row => 
    `<tr>
      <td>${row.service}</td>
      <td style="text-align:center;">${row.taxed ? 'X' : ''}</td>
      <td style="text-align:right;">${formatCurrency(row.amount)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root { --tbs-navy: #17365D; --tbs-blue: #2F5597; --row-alt: #f6f7fb; --muted: #6b7280; }
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; }
    body { font-family: Arial, Helvetica, sans-serif; color:#111; padding: 20px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
    .header .brand { display:flex; gap:12px; align-items:center; }
    .header .brand img { height:60px; }
    .header .brand .company { font-weight:700; font-size:12px; line-height:1.1; }
    .header .meta { text-align:right; font-size:12px; }
    .title { text-align:center; letter-spacing:1px; font-weight:700; font-size:26px; color:var(--tbs-blue); }
    .billto-bar { background:var(--tbs-navy); color:#fff; padding:6px 10px; font-weight:700; margin:18px 0 8px; }
    .billto { display:flex; gap:16px; justify-content:space-between; font-size:13px; }
    .billto-right { display:flex; flex-direction:column; gap:4px; }
    .table { width:100%; border-collapse:collapse; margin-top:16px; font-size:13px; }
    .table th { background:var(--tbs-navy); color:#fff; text-align:left; padding:8px; font-weight:700; border:1px solid #1f2d44; }
    .table td { padding:8px; border:1px solid #d1d5db; }
    .table tr:nth-child(even) td { background:#f9fafb; }
    .totals { margin-top:14px; width:50%; margin-left:auto; font-size:13px; }
    .totals .row { display:flex; justify-content:space-between; padding:6px 8px; border-bottom:1px solid #e5e7eb; }
    .totals .grand { font-weight:700; border-top:2px solid #111; }
    .footer { margin-top:20px; font-size:11.5px; color:#111; border-top:2px solid var(--tbs-navy); padding-top:10px; text-align:center; }
    @page { size: A4; margin: 18mm; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${assets.logo}" alt="TBS Logo" />
      <div class="company">
        <div style="font-size:14px; font-weight:bold;">TBS</div>
        <div>Traffic and Barrier Solutions, LLC</div>
        <div>1999 Dews Pond Rd SE</div>
        <div>Calhoun, GA 30701</div>
        <div>Cell: 706-263-0175</div>
        <div>Email: tbsolutions3@gmail.com</div>
        <div>Website: www.TrafficBarrierSolutions.com</div>
      </div>
    </div>
    <div class="meta">
      <div>DATE: ${invoiceData.invoiceDate || new Date().toLocaleDateString()}</div>
      <div>INVOICE #: ${invoiceData.invoiceNumber || String(workOrder._id || 'INV001').slice(-6)}</div>
      ${invoiceData.workRequestNumber1 ? `<div>WR#: ${invoiceData.workRequestNumber1}</div>` : ''}
      ${invoiceData.workRequestNumber2 ? `<div>WR#: ${invoiceData.workRequestNumber2}</div>` : ''}
      ${invoiceData.dueDate ? `<div>DUE DATE: ${invoiceData.dueDate}</div>` : ''}
    </div>
  </div>
  
  <h1 class="title">INVOICE</h1>
  
  <div class="billto-bar">BILL TO</div>
  <div class="billto">
    <div class="left">
      <div><strong>${invoiceData.billToCompany || workOrder.basic?.client}</strong></div>
      <div>${invoiceData.billToAddress || (workOrder.basic?.address + ', ' + workOrder.basic?.city + ', ' + workOrder.basic?.state + ' ' + workOrder.basic?.zip)}</div>
    </div>
    <div class="billto-right">
      ${invoiceData.workType ? `<div><strong>Work Type:</strong> ${invoiceData.workType}</div>` : ''}
      ${invoiceData.foreman ? `<div><strong>Foreman:</strong> ${invoiceData.foreman}</div>` : ''}
      ${invoiceData.location ? `<div><strong>Job Site Location:</strong> ${invoiceData.location}</div>` : ''}
    </div>
  </div>
  
  <table class="table">
    <thead>
      <tr>
        <th>SERVICE</th>
        <th style="text-align:center;">TAXED</th>
        <th style="text-align:right;">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${serviceRowsHTML}
    </tbody>
  </table>
  
  <div class="totals">
    <div class="row">
      <span>Subtotal</span>
      <span>${formatCurrency(invoiceData.sheetSubtotal || manualAmount)}</span>
    </div>
    ${invoiceData.sheetTaxDue > 0 ? `
    <div class="row">
      <span>Tax (${invoiceData.sheetTaxRate}%)</span>
      <span>${formatCurrency(invoiceData.sheetTaxDue)}</span>
    </div>` : ''}
    ${invoiceData.sheetOther !== 0 ? `
    <div class="row">
      <span>Other</span>
      <span>${formatCurrency(invoiceData.sheetOther)}</span>
    </div>` : ''}
    <div class="row grand">
      <span>TOTAL</span>
      <span>${formatCurrency(invoiceData.sheetTotal || manualAmount)}</span>
    </div>
  </div>
  
  <div class="footer">
    <div><strong>Fully Loaded Vehicle</strong></div>
    <div>• 8 to 10 signs for flagging and lane operations</div>
    <div>• 2 STOP & GO paddles • 2 Certified Flaggers & Vehicle with Strobes</div>
    <div>• 30 Cones & 2 Barricades</div>
    <div style="margin-top:10px;">** Arrow Board upon request: additional fees will be applied</div>
    <div>Late payment fee will go into effect if payment is not received 30 days after receiving Invoice.</div>
    <div style="margin-top:10px;"><strong>Make all checks payable to TBS</strong></div>
    <div style="margin-top:10px;">If you have any questions about this invoice, please contact<br/>[Bryson Davis, 706-263-0715, tbsolutions3@gmail.com]</div>
    <div style="margin-top:10px; font-weight:bold;">Thank You For Your Business!</div>
  </div>
</body>
</html>`;
}
const os = require('os');

async function generateInvoicePdf(workOrder, manualAmount, invoiceData = {}) {
  const logoPath = path.resolve(__dirname, '../public/TBSPDF7.png');
  const assets = { logo: toDataUri(logoPath) };
  const html = renderInvoiceHTML(workOrder, manualAmount, assets, invoiceData);

  let browser;
  try {
    // Try system Chrome first, then fallback to bundled
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PUPPETEER_EXECUTABLE_PATH
    ].filter(Boolean);

    let executablePath;
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        executablePath = chromePath;
        break;
      }
    }

    console.log('[invoice] launching Chrome at:', executablePath || 'bundled');
    
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
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
    
    console.log('[invoice] PDF generated, size:', pdfBuffer.length, 'bytes');
    
    // Also save to temp file for debugging
    const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');
    const datePart = workOrder.basic?.dateOfJob || new Date().toISOString().slice(0,10);
    const tmpFile = path.join(os.tmpdir(), `invoice-${safeClient}-${datePart}.pdf`);
    fs.writeFileSync(tmpFile, pdfBuffer);
    console.log('[invoice] saved copy to:', tmpFile);

    return pdfBuffer; // return buffer for reliable attachment
  } finally {
    if (browser) await browser.close();
  }
}


 const { exportInvoicesXlsx } = require('../services/invoiceExcel');
 const { currentTotal } = require('../utils/invoiceMath');
 const { transporter7 } = require('../utils/emailConfig');
 const { computeTotalFromSelections } = require('../utils/pricing');
 const authJwt = require('../middleware/authJwt');
const PriceList = require('../models/priceList');

const corsOptions = {
  origin: ['http://localhost:5173','http://127.0.0.1:5173','https://www.trafficbarriersolutions.com'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};

router.use(cors(corsOptions));
router.options('*', cors(corsOptions));

router.use((req, res, next) => {
  console.log('[billing router]', req.method, req.originalUrl, req.path);
  next();
});

// Skip auth for bill-workorder route
router.use((req, res, next) => {
  if (req.path === '/bill-workorder') {
    console.log('Skipping auth for bill-workorder');
    return next();
  }
  auth(req, res, next);
});

router.use((req, res, next) => {
  if (req.path === '/bill-workorder') {
    return next();
  }
  requireInvoiceAdmin(req, res, next);
});

router.post('/bill-workorder', async (req, res) => {
  console.log('*** BILLING ROUTER - BILL WORKORDER HIT ***');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { workOrderId, manualAmount, emailOverride, invoiceData } = req.body;
    const WorkOrder = require('../models/workorder');

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });
    if (workOrder.billed) return res.status(409).json({ message: 'Work order already billed' });

    // Mark work order as billed
    await WorkOrder.updateOne(
      { _id: workOrder._id },
      { $set: { billed: true, billedAt: new Date(), billedAmount: manualAmount } },
      { runValidators: false }
    );

    // Generate PDF and send invoice email
    console.log('Email override value:', emailOverride);
    if (emailOverride) {
      console.log('Attempting to send email to:', emailOverride);
      
      // Generate invoice PDF
      let pdfBuffer = null;
      try {
        console.log('Starting PDF generation…');
        pdfBuffer = await generateInvoicePdf(workOrder, manualAmount, invoiceData);
      } catch (e) {
        console.error('[invoice] PDF generation failed:', e);
      }

      const emailHtml = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">Invoice - ${workOrder.basic?.client}</h1>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; font-size: 16px;"><strong>Invoice Amount:</strong> $${Number(manualAmount).toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Work Order Date:</strong> ${workOrder.basic?.dateOfJob}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${workOrder.basic?.project}</p>
                <p style="margin: 5px 0;"><strong>Address:</strong> ${workOrder.basic?.address}, ${workOrder.basic?.city}, ${workOrder.basic?.state} ${workOrder.basic?.zip}</p>
              </div>
              
              <p style="text-align: center; font-size: 16px; margin: 30px 0;">Please find the attached invoice PDF. Thank you for your business!</p>
              
              <div style="text-align: center; border-top: 2px solid #efad76; padding-top: 15px; margin-top: 30px;">
                <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
                <p style="margin: 5px 0;">1995 Dews Pond Rd SE, Calhoun, GA 30701</p>
                <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
              </div>
            </div>
          </body>
        </html>
      `;
const mailOptions = {
  from: 'trafficandbarriersolutions.ap@gmail.com',
  to: emailOverride,
  subject: `INVOICE – ${workOrder.basic?.client} – $${Number(manualAmount).toFixed(2)}`,
  html: emailHtml,
  attachments: []
};
      if (pdfBuffer && pdfBuffer.length > 0) {
        console.log('Adding PDF attachment, size:', pdfBuffer.length, 'bytes');
        const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');
        mailOptions.attachments.push({
          filename: `invoice-${safeClient}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
      } else {
        console.warn('[invoice] No PDF buffer available; sending without attachment');
      }
      try {
        const info = await transporter7.sendMail(mailOptions);
        console.log('[invoice] email sent', { to: emailOverride, messageId: info.messageId, attached: !!mailOptions.attachments.length });
        

      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    } else {
      console.log('No email override provided, skipping email');
    }

    console.log('Work order marked as billed successfully');
    res.json({ message: 'Work order billed successfully', workOrderId: workOrder._id });
  } catch (e) {
    console.error('Bill work order error:', e);
    res.status(500).json({ message: 'Failed to bill work order', error: e.message });
  }
});

module.exports = router;

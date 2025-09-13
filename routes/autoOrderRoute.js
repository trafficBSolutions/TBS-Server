const express = require('express');
const router = express.Router();
const cors = require('cors');
const WorkOrder = require('../models/workorder');
const ControlUser = require('../models/controluser');
const { transporter } = require('../utils/emailConfig');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function verifyToken(t) { 
  try {
    const decoded = jwt.verify(t, process.env.JWT_SECRET);
    console.log('JWT decoded successfully:', { email: decoded.email, role: decoded.role, id: decoded.id });
    return decoded;
  } catch (error) {
    console.log('JWT verification failed:', error.message);
    return null; 
  } 
}
function getUserFromReq(req) {
  const candidates = [];
  if (req.cookies?.empToken) candidates.push(verifyToken(req.cookies.empToken));
  if (req.cookies?.token)   candidates.push(verifyToken(req.cookies.token));
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) candidates.push(verifyToken(auth.slice(7)));

  console.log('JWT candidates:', candidates.map(c => c ? { email: c.email, role: c.role, id: c.id } : null));

  const ALLOWED = new Set(['admin','employee','invoice','invoice_admin','invoiceAdmin','superadmin']);
  const withRole = candidates.find(u => u && u.role && ALLOWED.has(u.role));
  if (withRole) return withRole;

  // back-compat: some old admin tokens only had an email
  const adminish = candidates.find(u => u && (u.email || u.isAdmin === true || u.scope === 'admin'));
  if (adminish) return { ...adminish, role: adminish.role || 'admin' };

  return candidates.find(Boolean) || null;
}


const ALLOWED_ROLES = new Set(['admin','employee','invoice','invoice_admin','invoiceAdmin','superadmin']);

function requireStaff(req, res, next) {
  // Temporary bypass for development - allow all requests
  console.log('Bypassing authentication for development');
  req.user = { email: 'dev@tbs.com', role: 'admin', id: 'dev-user' };
  next();
}

function toDataUri(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.svg' ? 'image/svg+xml' :
    'application/octet-stream';
  const buf = fs.readFileSync(absPath);
  const base64 = buf.toString('base64');
  return `data:${mime};base64,${base64}`;
}

function renderWorkOrderHTML(wo, assets) {
  const { tbs, basic, mismatch } = wo;
  const m = tbs.morning || {};
  const js = tbs.jobsite || {};
  const keys = ['hardHats','vests','walkies','arrowBoards','cones','barrels','signStands','signs'];

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Work Order – ${basic.client} – ${basic.dateOfJob}</title>
<style>
  @page { size: Letter; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.1; z-index: -1; }
  .watermark img { height: 500px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #efad76; padding-bottom: 10px; margin-bottom: 15px; }
  .logo-section img { height: 50px; }
  .title-section h1 { margin: 0; font-size: 24px; }
  .title-section p { margin: 5px 0 0 0; font-size: 12px; }
  .section { margin: 10px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
  .section h3 { margin: 0 0 8px 0; background: #efad76; padding: 5px; border-radius: 3px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field { display: flex; gap: 5px; margin-bottom: 3px; }
  .label { width: 100px; font-weight: bold; font-size: 9px; }
  .value { font-size: 9px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
  th { background-color: #f2f2f2; }
  .flaggers { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
  .trucks { font-size: 9px; }
  .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .signature-section { text-align: center; margin-top: 10px; }
  .signature-section img { max-height: 60px; }
</style>
</head>
<body>
  <div class="watermark">
    <img src="${assets.cone}" alt="Watermark" />
  </div>
  <div class="header">
    <div class="logo-section">
      <img src="${assets.logo}" alt="TBS Logo" />
    </div>
    <div class="title-section">
      <h1>Work Order</h1>
      <p>Date: ${basic.dateOfJob}</p>
    </div>
  </div>
  
  <div class="section">
    <h3>Company Information</h3>
    <div class="grid">
      <div class="field"><span class="label">Company:</span><span class="value">${basic.client}</span></div>
      <div class="field"><span class="label">Coordinator:</span><span class="value">${formatName(basic.coordinator)}</span></div>
      <div class="field"><span class="label">Project:</span><span class="value">${basic.project}</span></div>
      <div class="field"><span class="label">Time:</span><span class="value">${formatTime(basic.startTime)} - ${formatTime(basic.endTime)}</span></div>
      <div class="field"><span class="label">Address:</span><span class="value">${basic.address}</span></div>
      <div class="field"><span class="label">City/State/Zip:</span><span class="value">${basic.city}, ${basic.state} ${basic.zip}</span></div>
      ${basic.rating ? `<div class="field"><span class="label">Rating:</span><span class="value">${basic.rating}</span></div>` : ''}
      ${basic.notice24 ? `<div class="field"><span class="label">24hr Notice:</span><span class="value">${basic.notice24}</span></div>` : ''}
      ${basic.callBack ? `<div class="field"><span class="label">Call Back:</span><span class="value">${basic.callBack}</span></div>` : ''}
    </div>
    ${basic.notes ? `<div style="margin-top: 5px;"><strong>Notes:</strong> ${basic.notes}</div>` : ''}
  </div>

  <div class="section">
    <h3>TBS Employees</h3>
    <div class="flaggers">
      ${tbs.flagger1 ? `<div><strong>Flagger 1:</strong> ${formatName(tbs.flagger1)}</div>` : ''}
      ${tbs.flagger2 ? `<div><strong>Flagger 2:</strong> ${formatName(tbs.flagger2)}</div>` : ''}
      ${tbs.flagger3 ? `<div><strong>Flagger 3:</strong> ${formatName(tbs.flagger3)}</div>` : ''}
      ${tbs.flagger4 ? `<div><strong>Flagger 4:</strong> ${formatName(tbs.flagger4)}</div>` : ''}
      ${tbs.flagger5 ? `<div><strong>Flagger 5:</strong> ${formatName(tbs.flagger5)}</div>` : ''}
    </div>
    ${tbs.trucks?.length ? `<div class="trucks"><strong>Trucks:</strong> ${tbs.trucks.join(', ')}</div>` : ''}
  </div>

  <div class="section">
    <h3>Morning Checklist</h3>
    <table>
      <thead><tr><th>Item</th><th>Started</th><th>Ended</th></tr></thead>
      <tbody>
        ${keys.map(k => `<tr><td>${formatEquipmentName(k)}</td><td>${m[k]?.start ?? ''}</td><td>${m[k]?.end ?? ''}</td></tr>`).join('')}
      </tbody>
    </table>
    ${mismatch ? '<div style="color: #B45309; font-weight: bold; margin-top: 5px;">⚠️ Equipment counts mismatch detected</div>' : ''}
  </div>

  <div class="section">
    <h3>Jobsite Checklist</h3>
    <div class="checklist">
      <div>✓ Visibility: ${js.visibility ? 'Yes' : 'No'}</div>
      <div>✓ Communication: ${js.communication ? 'Yes' : 'No'}</div>
      <div>✓ Site Foreman: ${js.siteForeman ? 'Yes' : 'No'}</div>
      <div>✓ Signs/Stands: ${js.signsAndStands ? 'Yes' : 'No'}</div>
      <div>✓ Cones/Taper: ${js.conesAndTaper ? 'Yes' : 'No'}</div>
      <div>✓ Equipment Left: ${js.equipmentLeft ? 'Yes' : 'No'}</div>
    </div>
    ${js.equipmentLeft && js.equipmentLeftReason ? `<div style="margin-top: 8px; padding: 5px; background: #f9f9f9; border-radius: 3px;"><strong>Equipment Left Reason:</strong> ${js.equipmentLeftReason}</div>` : ''}
    </div>
  </div>

  <div class="signature-section">
    <h3>Job Site Foreman</h3>
    ${wo.foremanSignature ? `<img src="data:image/png;base64,${wo.foremanSignature}" alt="Foreman Signature" />` : ''}
    <p><strong>${formatName(basic.foremanName)}</strong></p>
  </div>
</body>
</html>`;
}

function formatName(name) {
  return name ? name.replace(/\b\w/g, l => l.toUpperCase()) : '';
}

function formatEquipmentName(key) {
  const names = {
    hardHats: 'Hard Hats',
    vests: 'Vests', 
    walkies: 'Walkie Talkies',
    arrowBoards: 'Arrow Boards',
    cones: 'Cones',
    barrels: 'Barrels',
    signStands: 'Sign Stands',
    signs: 'Signs'
  };
  return names[key] || key;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes}${ampm}`;
}

async function generateWorkOrderPdf(wo) {
  const conePath = path.join(__dirname, '..', 'public', 'brand', 'tbs-cone.svg');
  const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
  const assets = { cone: toDataUri(conePath), logo: toDataUri(logoPath) };

  const html = renderWorkOrderHTML(wo, assets);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

router.use(cors({ credentials: true, origin: [
  'http://localhost:5173',
  'https://www.trafficbarriersolutions.com'
]}));

router.post('/work-order', requireStaff, async (req, res) => {
  try {
    const {
      jobId,
      scheduledDate,
      basic = {},
      tbs,
      mismatch,
      foremanSignature
    } = req.body;

    if (!foremanSignature) {
      return res.status(400).json({ error: 'Foreman signature is required' });
    }
    if (!scheduledDate) return res.status(400).json({ error: 'scheduledDate is required' });

    let job = null;
    if (jobId) {
      job = await ControlUser.findById(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
    }

    const clientOrCompany = (basic.client && basic.client.trim()) || (basic.company && basic.company.trim());
    const reqBasic = ['dateOfJob','coordinator','project','address','city','state','zip','startTime','endTime'];
    
    if (!basic || !clientOrCompany || !reqBasic.every(k => String(basic[k] || '').trim() !== '')) {
      return res.status(400).json({ error: 'Missing required basic fields' });
    }

    const foremanName = (basic.foremanName || '').trim();
    if (!foremanName) return res.status(400).json({ error: 'Foreman name is required' });

    const m = tbs?.morning || {};
    const keys = ['hardHats','vests','walkies','arrowBoards','cones','barrels','signStands','signs'];
    
    if (!tbs?.flagger1?.trim() || !tbs?.flagger2?.trim()) {
      return res.status(400).json({ error: 'First two flaggers are required' });
    }
    
    if (!keys.every(k => m[k]?.start !== undefined && m[k]?.end !== undefined)) {
      return res.status(400).json({ error: 'All morning checklist fields are required' });
    }
    
    const js = tbs?.jobsite || {};
    const firstFiveOk = js.visibility && js.communication && js.siteForeman && js.signsAndStands && js.conesAndTaper;
    if (!firstFiveOk) return res.status(400).json({ error: 'First 5 jobsite checklist items are required' });

    const mismatchServer = keys.some(k => Number(m[k].start) !== Number(m[k].end));
    if (mismatchServer && !js.equipmentLeft) {
      return res.status(400).json({ error: 'Equipment Left After Hours must be checked when counts mismatch' });
    }

    const scheduled = new Date(scheduledDate + 'T00:00:00');

    const created = await WorkOrder.create({
      ...(job ? { job: job._id } : {}),
      scheduledDate: scheduled,
      basic: { ...basic, client: basic.client || basic.company, foremanName },
      tbs,
      mismatch: !!(mismatch || mismatchServer),
      ...(foremanSignature ? { foremanSignature } : {})
    });

    const pdfBuffer = await generateWorkOrderPdf(created);
    
    // Save PDF to filesystem
    const pdfDir = path.join(__dirname, '..', 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    const pdfPath = path.join(pdfDir, `${created._id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    
    const html = `
    <html>
      <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
        <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
          <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">WORK ORDER COMPLETED</h1>
          
          <p>A work order has been completed for <strong>${clientOrCompany}</strong>.</p>
          
          <h3>Company Information:</h3>
          <ul>
            <li><strong>Date:</strong> ${basic.dateOfJob}</li>
            <li><strong>Company:</strong> ${basic.client}</li>
            <li><strong>Coordinator:</strong> ${formatName(basic.coordinator)}</li>
            <li><strong>Project:</strong> ${basic.project}</li>
            <li><strong>Address:</strong> ${basic.address}, ${basic.city}, ${basic.state} ${basic.zip}</li>
            <li><strong>Time:</strong> ${formatTime(basic.startTime)} - ${formatTime(basic.endTime)}</li>
            ${basic.rating ? `<li><strong>Rating:</strong> ${basic.rating}</li>` : ''}
            ${basic.notice24 ? `<li><strong>24 Hour Notice:</strong> ${basic.notice24}</li>` : ''}
            ${basic.callBack ? `<li><strong>Call Back:</strong> ${basic.callBack}</li>` : ''}
          </ul>
          
          <h3>TBS Employees:</h3>
          <ul>
            ${tbs.flagger1 ? `<li><strong>Flagger 1:</strong> ${formatName(tbs.flagger1)}</li>` : ''}
            ${tbs.flagger2 ? `<li><strong>Flagger 2:</strong> ${formatName(tbs.flagger2)}</li>` : ''}
            ${tbs.flagger3 ? `<li><strong>Flagger 3:</strong> ${formatName(tbs.flagger3)}</li>` : ''}
            ${tbs.flagger4 ? `<li><strong>Flagger 4:</strong> ${formatName(tbs.flagger4)}</li>` : ''}
            ${tbs.flagger5 ? `<li><strong>Flagger 5:</strong> ${formatName(tbs.flagger5)}</li>` : ''}
            ${tbs.trucks?.length ? `<li><strong>Trucks:</strong> ${tbs.trucks.join(', ')}</li>` : ''}
          </ul>
          
          <h3>Equipment Summary:</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
            <tr style="background: #f2f2f2;"><th style="border: 1px solid #ddd; padding: 8px;">Item</th><th style="border: 1px solid #ddd; padding: 8px;">Started</th><th style="border: 1px solid #ddd; padding: 8px;">Ended</th></tr>
            ${['hardHats','vests','walkies','arrowBoards','cones','barrels','signStands','signs'].map(k => 
              `<tr><td style="border: 1px solid #ddd; padding: 8px;">${formatEquipmentName(k)}</td><td style="border: 1px solid #ddd; padding: 8px;">${m[k]?.start ?? ''}</td><td style="border: 1px solid #ddd; padding: 8px;">${m[k]?.end ?? ''}</td></tr>`
            ).join('')}
          </table>
          
          ${tbs.jobsite?.equipmentLeft && tbs.jobsite?.equipmentLeftReason ? `<h3>Equipment Left Behind:</h3><p style="background: #f9f9f9; padding: 10px; border-radius: 5px;"><strong>Reason:</strong> ${tbs.jobsite.equipmentLeftReason}</p>` : ''}
          
          <h3>Job Site Foreman:</h3>
          ${foremanSignature ? `<div style="text-align: center; margin: 10px 0; padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Signature Captured</strong><br/><em>(See attached PDF for signature image)</em></div>` : ''}
          <p><strong>${formatName(basic.foremanName)}</strong></p>
          
          ${basic.notes ? `<h3>Additional Notes:</h3><p>${basic.notes}</p>` : ''}
          
          <hr style="margin: 20px 0;">
          <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
        </div>
      </body>
    </html>
    `;

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: ['trafficandbarriersolutions.ap@gmail.com'],
      bcc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: 'tbsolutions9@gmail.com' },
        { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
        { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
        { name: 'Salvador Gonzalez', address: 'tbsolutions77@gmail.com' },
        { name: 'Damien Diskey', address: 'tbsolutions14@gmail.com' },
      ],
      subject: `WORK ORDER – ${clientOrCompany} – ${basic.dateOfJob}`,
      html,
      attachments: [
        {
          filename: `work-order-${created._id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },

      ],
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error('Work order email error:', err);
      else console.log('Work order email sent:', info.response);
    });

    res.status(201).json({ message: 'Work order created', workOrderId: created._id });
  } catch (e) {
    console.error('Create work order failed:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/pdfs/:id', requireStaff, async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, '..', 'pdfs', `${req.params.id}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).send('PDF not found');
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="work-order-${req.params.id}.pdf"`);
    res.sendFile(pdfPath);
  } catch (e) {
    console.error('Error serving PDF:', e);
    res.status(500).send('Error serving PDF');
  }
});

router.get('/work-order/:id/pdf', requireStaff, async (req, res) => {
  try {
    const pdfPath = path.join(__dirname, '..', 'pdfs', `${req.params.id}.pdf`);
    
    if (fs.existsSync(pdfPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="work-order-${req.params.id}.pdf"`);
      return res.sendFile(pdfPath);
    }
    
    // Fallback: generate PDF if not found
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).send('Work order not found');

    const conePath = path.join(__dirname, '..', 'public', 'brand', 'tbs-cone.svg');
    const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
    const assets = { cone: toDataUri(conePath), logo: toDataUri(logoPath) };

    const html = renderWorkOrderHTML(wo, assets);

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="work-order-${wo._id}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error('Error generating PDF:', e);
    res.status(500).send('Error generating PDF');
  }
});

router.get('/work-orders/month', requireStaff, async (req, res) => {
  try {
    const { month, year } = req.query;
    console.log(`[DEBUG] Monthly work orders request: month=${month}, year=${year}`);
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    console.log(`[DEBUG] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const workOrders = await WorkOrder.find({
      scheduledDate: { $gte: startDate, $lte: endDate }
    }).sort({ scheduledDate: 1 });
    
    console.log(`[DEBUG] Found ${workOrders.length} work orders for month ${month}/${year}`);
    workOrders.forEach((wo, i) => {
      console.log(`[DEBUG] Work Order ${i + 1}: ${wo.basic?.client} on ${wo.scheduledDate?.toISOString()}`);
    });
    
    res.json(workOrders);
  } catch (e) {
    console.error('Failed to fetch monthly work orders:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/work-orders', requireStaff, async (req, res) => {
  try {
    const { date } = req.query;
    console.log(`[DEBUG] *** WORK ORDERS ROUTE HIT *** date=${date}`);
    
    if (!date) return res.status(400).json({ error: 'Date parameter required' });
    
    console.log(`[DEBUG] Daily work orders request for date: ${date}`);
    
    const startDate = new Date(date + 'T00:00:00Z');
    const endDate = new Date(date + 'T23:59:59Z');
    console.log(`[DEBUG] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // First, let's see ALL work orders in the database
    const allWorkOrders = await WorkOrder.find({}).sort({ createdAt: -1 });
    console.log(`[DEBUG] Total work orders in database: ${allWorkOrders.length}`);
    
    const workOrders = await WorkOrder.find({
      scheduledDate: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 });
    
    console.log(`[DEBUG] Found ${workOrders.length} work orders for date ${date}`);
    workOrders.forEach((wo, i) => {
      console.log(`[DEBUG] Work Order ${i + 1}: ${wo.basic?.client} scheduled for ${wo.scheduledDate?.toISOString()}`);
    });
    
    res.json(workOrders);
  } catch (e) {
    console.error('Failed to fetch daily work orders:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/auth/debug', (req, res) => {
  const auth = req.headers.authorization || '';
  res.json({
    ok: true,
    origin: req.headers.origin,
    hasAuthHeader: !!auth,
    authPrefix: auth.slice(0, 10),
    hasEmpToken: !!req.cookies?.empToken,
    hasLegacyToken: !!req.cookies?.token,
  });
});

router.use((req, _res, next) => {
  if (req.path === '/work-order') {
    console.log('[work-order]',
      'Origin:', req.headers.origin,
      'HasAuth:', (req.headers.authorization || '').startsWith('Bearer '),
      'HasEmpToken:', !!req.cookies?.empToken,
      'HasLegacyToken:', !!req.cookies?.token
    );
  }
  next();
});

module.exports = router;



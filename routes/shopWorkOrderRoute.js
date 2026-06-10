const express = require('express');
const router = express.Router();
const ShopWorkOrder = require('../models/shopWorkOrder');
const TimeClock = require('../models/timeClock');
const TimeClockEmployee = require('../models/timeClockEmployee');
const Admin = require('../models/Admin');
const { transporter } = require('../utils/emailConfig');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Supervisors who can approve
const SUPERVISORS = [
  { name: 'Bryson Davis', email: 'tbsolutions9@gmail.com', username: 'tbsolutions9' },
  { name: 'Carson Speer', email: 'tbsolutions4@gmail.com', username: 'tbsolutions4' },
  { name: 'William Rowell', email: 'tbsolutions1999@gmail.com', username: 'tbsolutions1999' },
];

const ALLOWED_APPROVERS = new Set(SUPERVISORS.map(s => s.email));

function toDataUri(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
  const buf = fs.readFileSync(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function renderShopWorkOrderHTML(wo, options = {}) {
  const { approved, approverName } = options;
  const conePath = path.join(__dirname, '..', 'public', 'brand', 'tbs-cone.svg');
  const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
  const cone = fs.existsSync(conePath) ? toDataUri(conePath) : '';
  const logo = fs.existsSync(logoPath) ? toDataUri(logoPath) : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Shop Work Order</title>
<style>
  @page { size: Letter; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.08; z-index: -1; }
  .watermark img { height: 500px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #efad76; padding-bottom: 10px; margin-bottom: 20px; }
  .logo-section img { height: 50px; }
  .title-section h1 { margin: 0; font-size: 22px; }
  .field { margin: 8px 0; }
  .field .label { font-weight: bold; display: inline-block; width: 220px; }
  .description-box { border: 1px solid #ccc; padding: 12px; min-height: 200px; margin-top: 8px; white-space: pre-wrap; }
  .approval { margin-top: 30px; padding: 15px; border: 2px solid ${approved ? '#4CAF50' : '#ccc'}; border-radius: 8px; text-align: center; }
  .approval h3 { color: ${approved ? '#4CAF50' : '#666'}; }
</style></head><body>
  <div class="watermark">${cone ? `<img src="${cone}" alt=""/>` : ''}</div>
  <div class="header">
    <div class="logo-section">${logo ? `<img src="${logo}" alt="TBS"/>` : ''}</div>
    <div class="title-section"><h1>Shop Work Order</h1></div>
  </div>
  <div class="field"><span class="label">Employee Name(s):</span> ${wo.employeeNames}</div>
  <div class="field"><span class="label">Truck # (if used):</span> ${wo.truckNumber || 'N/A'}</div>
  <div class="field"><span class="label">Date:</span> ${wo.date}</div>
  <div class="field"><span class="label">In Time:</span> ${wo.inTime}</div>
  <div class="field"><span class="label">Out Time:</span> ${wo.outTime}</div>
  <div class="field"><span class="label">Location / Address:</span> ${wo.location}</div>
  <div class="field"><span class="label">Supervisor / Manager:</span> ${wo.supervisor}</div>
  <div class="field"><span class="label">Description of Task(s):</span></div>
  <div class="description-box">${wo.description}</div>
  ${approved ? `
  <div class="approval">
    <h3>✅ APPROVED</h3>
    <p>Approved by: <strong>${approverName}</strong></p>
    <p>Approved at: ${new Date(wo.approvedAt).toLocaleString()}</p>
  </div>` : ''}
</body></html>`;
}

async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
  } finally {
    await browser.close();
  }
}

// Submit a new shop work order
router.post('/shop-work-order', async (req, res) => {
  try {
    const { employeeNames, truckNumber, date, inTime, outTime, location, supervisor, description, submittedBy } = req.body;
    if (!employeeNames || !date || !inTime || !outTime || !location || !supervisor || !description) {
      return res.status(400).json({ error: 'All required fields must be filled out.' });
    }

    const wo = await ShopWorkOrder.create({ employeeNames, truckNumber, date, inTime, outTime, location, supervisor, description, submittedBy });

    // Generate PDF for review
    const html = renderShopWorkOrderHTML(wo);
    const pdfBuffer = await generatePdf(html);

    // Save PDF
    const pdfDir = path.join(__dirname, '..', 'pdfs', 'shop-work-orders');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    fs.writeFileSync(path.join(pdfDir, `${wo._id}.pdf`), pdfBuffer);

    // Build approval URL base - must point to the API server for processing
    const apiBase = process.env.API_BASE_URL || 'https://tbs-server.onrender.com';

    // Send email to supervisors for approval
    const approvalHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#efad76;padding:20px;text-align:center;">
        <h1 style="color:#fff;margin:0;">Shop Work Order - Pending Approval</h1>
      </div>
      <div style="padding:20px;background:#f9f9f9;">
        <p>A new Shop Work Order has been submitted and requires your approval.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Employee(s):</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.employeeNames}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Date:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.date}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Time:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.inTime} - ${wo.outTime}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Location:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.location}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Supervisor:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.supervisor}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Description:</td><td style="padding:8px;">${wo.description.substring(0, 200)}${wo.description.length > 200 ? '...' : ''}</td></tr>
        </table>
        <div style="margin-top:20px;text-align:center;">
          <a href="${apiBase}/shop-work-order/approve/${wo._id}" style="display:inline-block;padding:12px 30px;background:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;margin:5px;font-weight:bold;">✅ APPROVE</a>
          <a href="${apiBase}/shop-work-order/disapprove/${wo._id}" style="display:inline-block;padding:12px 30px;background:#f44336;color:#fff;text-decoration:none;border-radius:5px;margin:5px;font-weight:bold;">❌ DISAPPROVE</a>
        </div>
        <p style="margin-top:15px;font-size:12px;color:#666;">PDF is attached for your review. Click Approve or Disapprove above.</p>
      </div>
    </div>`;

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: SUPERVISORS.map(s => s.email),
      subject: `SHOP WORK ORDER – Pending Approval – ${wo.employeeNames} – ${wo.date}`,
      html: approvalHtml,
      attachments: [{ filename: `shop-work-order-${wo._id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error('Shop work order email error:', err);
      else console.log('Shop work order approval email sent:', info.response);
    });

    // Auto-clock-out all listed employees who are currently clocked in on Shop Work/Standby
    // ONLY for Standby employees (Shop Work employees clock out on their own)
    const clockedOutNames = [];
    try {
      const names = employeeNames.split(',').map(n => n.trim()).filter(Boolean);
      for (const name of names) {
        // Find employee by name
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        let empId = null;
        if (firstName && lastName) {
          const emp = await TimeClockEmployee.findOne({
            firstName: { $regex: new RegExp('^' + firstName + '$', 'i') },
            lastName: { $regex: new RegExp('^' + lastName + '$', 'i') }
          });
          if (emp) empId = emp._id;
        }
        if (!empId) {
          const admin = await Admin.findOne({
            firstName: { $regex: new RegExp('^' + firstName + '$', 'i') },
            lastName: { $regex: new RegExp('^' + (lastName || '') + '$', 'i') }
          });
          if (admin) empId = admin._id;
        }
        if (empId) {
          // Only auto-clock-out Standby employees
          const openEntry = await TimeClock.findOne({ employeeId: empId, clockOut: null, purpose: 'Standby' });
          if (openEntry) {
            openEntry.clockOut = new Date();
            await openEntry.save();
            clockedOutNames.push(name);
          }
        }
      }
      if (clockedOutNames.length > 0) {
        console.log('[Shop WO] Auto-clocked out standby:', clockedOutNames.join(', '));
      }
    } catch (clockErr) {
      console.error('[Shop WO] Auto-clock-out error:', clockErr);
    }

    res.status(201).json({ message: 'Shop work order submitted for approval', id: wo._id, clockedOut: clockedOutNames });
  } catch (e) {
    console.error('Shop work order submission failed:', e);
    res.status(500).json({ error: 'Internal Server Error', details: e.message });
  }
});

// Approve endpoint
router.get('/shop-work-order/approve/:id', async (req, res) => {
  try {
    const wo = await ShopWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).send('Work order not found.');
    if (wo.status !== 'pending') return res.send(`<h2>This work order has already been ${wo.status}.</h2>`);

    // Show approval confirmation page
    res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Approve Shop Work Order</title>
    <style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;margin:0;}
    .card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:500px;}
    .btn{display:inline-block;padding:15px 40px;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;margin:10px;text-decoration:none;color:#fff;}
    .approve{background:#4CAF50;}.disapprove{background:#f44336;}
    select{padding:10px;font-size:14px;border-radius:5px;border:1px solid #ddd;margin:10px 0;width:100%;}
    </style></head><body>
    <div class="card">
      <h2>Shop Work Order Approval</h2>
      <p><strong>Employee:</strong> ${wo.employeeNames}</p>
      <p><strong>Date:</strong> ${wo.date}</p>
      <p><strong>Location:</strong> ${wo.location}</p>
      <form method="POST" action="/shop-work-order/approve/${wo._id}">
        <label><strong>Approving as:</strong></label>
        <select name="approver" required>
          <option value="">Select your name</option>
          ${SUPERVISORS.map(s => `<option value="${s.email}">${s.name}</option>`).join('')}
        </select>
        <br/>
        <button type="submit" class="btn approve">✅ Approve</button>
      </form>
      <a href="/shop-work-order/disapprove/${wo._id}" class="btn disapprove">❌ Disapprove</a>
    </div></body></html>`);
  } catch (e) {
    res.status(500).send('Error loading approval page.');
  }
});

// POST approve
router.post('/shop-work-order/approve/:id', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { approver } = req.body;
    if (!approver || !ALLOWED_APPROVERS.has(approver)) {
      return res.status(403).send('<h2>Unauthorized approver.</h2>');
    }

    const wo = await ShopWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).send('Work order not found.');
    if (wo.status !== 'pending') return res.send(`<h2>This work order has already been ${wo.status}.</h2>`);

    const approverInfo = SUPERVISORS.find(s => s.email === approver);
    wo.status = 'approved';
    wo.approvedBy = approverInfo.name;
    wo.approvedAt = new Date();
    await wo.save();

    // Generate approved PDF
    const html = renderShopWorkOrderHTML(wo, { approved: true, approverName: approverInfo.name });
    const pdfBuffer = await generatePdf(html);

    // Save approved PDF
    const pdfDir = path.join(__dirname, '..', 'pdfs', 'shop-work-orders');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    fs.writeFileSync(path.join(pdfDir, `${wo._id}-approved.pdf`), pdfBuffer);

    // Email approved PDF to all supervisors
    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: SUPERVISORS.map(s => s.email),
      subject: `✅ APPROVED – Shop Work Order – ${wo.employeeNames} – ${wo.date}`,
      html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#4CAF50;">✅ Shop Work Order Approved</h2>
        <p>Approved by: <strong>${approverInfo.name}</strong></p>
        <p>Employee: ${wo.employeeNames}</p><p>Date: ${wo.date}</p><p>Location: ${wo.location}</p>
        <p>See attached approved PDF.</p></div>`,
      attachments: [{ filename: `shop-work-order-APPROVED-${wo._id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    };

    transporter.sendMail(mailOptions, (err) => { if (err) console.error('Approved email error:', err); });



    res.send(`<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:Arial;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;margin:0;}.card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;}</style></head><body><div class="card"><h2 style="color:#4CAF50;">✅ Work Order Approved!</h2><p>Approved by ${approverInfo.name}</p><p>An approved PDF has been sent to all supervisors via email.</p><p>Please check your email for the approved PDF.</p></div></body></html>`);
  } catch (e) {
    console.error('Approval failed:', e);
    res.status(500).send('Error processing approval.');
  }
});

// Disapprove endpoint
router.get('/shop-work-order/disapprove/:id', async (req, res) => {
  try {
    const wo = await ShopWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).send('Work order not found.');
    if (wo.status !== 'pending') return res.send(`<h2>This work order has already been ${wo.status}.</h2>`);

    wo.status = 'disapproved';
    await wo.save();

    // Notify via email
    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: SUPERVISORS.map(s => s.email),
      subject: `❌ DISAPPROVED – Shop Work Order – ${wo.employeeNames} – ${wo.date}`,
      html: `<div style="font-family:Arial;padding:20px;"><h2 style="color:#f44336;">❌ Shop Work Order Disapproved (VOID)</h2><p>Employee: ${wo.employeeNames}</p><p>Date: ${wo.date}</p><p>This work order has been voided and will not be processed.</p></div>`,
    }, () => {});

    res.send(`<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:Arial;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;margin:0;}.card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;}</style></head><body><div class="card"><h2 style="color:#f44336;">❌ Work Order Disapproved</h2><p>This work order has been voided and will not be processed.</p></div></body></html>`);
  } catch (e) {
    res.status(500).send('Error processing disapproval.');
  }
});

// Approve from admin dashboard (JSON API)
router.post('/shop-work-order/:id/dashboard-approve', express.json(), async (req, res) => {
  try {
    const { approver } = req.body;
    if (!approver || !ALLOWED_APPROVERS.has(approver)) {
      return res.status(403).json({ error: 'Unauthorized approver.' });
    }
    const wo = await ShopWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found.' });
    if (wo.status !== 'pending') return res.status(400).json({ error: `Already ${wo.status}` });

    const approverInfo = SUPERVISORS.find(s => s.email === approver);
    wo.status = 'approved';
    wo.approvedBy = approverInfo.name;
    wo.approvedAt = new Date();
    await wo.save();

    // Email notification
    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: SUPERVISORS.map(s => s.email),
      subject: `✅ APPROVED – Shop Work Order – ${wo.employeeNames} – ${wo.date}`,
      html: `<div style="font-family:Arial;padding:20px;"><h2 style="color:#4CAF50;">✅ Shop Work Order Approved</h2><p>Approved by: <strong>${approverInfo.name}</strong></p><p>Employee: ${wo.employeeNames}</p><p>Date: ${wo.date}</p><p>Location: ${wo.location}</p></div>`,
    }, () => {});

    res.json({ message: 'Approved', wo });
  } catch (e) {
    res.status(500).json({ error: 'Error processing approval.' });
  }
});

// Disapprove from admin dashboard (JSON API)
router.post('/shop-work-order/:id/dashboard-disapprove', express.json(), async (req, res) => {
  try {
    const { approver } = req.body;
    if (!approver || !ALLOWED_APPROVERS.has(approver)) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    const wo = await ShopWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found.' });
    if (wo.status !== 'pending') return res.status(400).json({ error: `Already ${wo.status}` });

    wo.status = 'disapproved';
    await wo.save();

    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: SUPERVISORS.map(s => s.email),
      subject: `❌ DISAPPROVED – Shop Work Order – ${wo.employeeNames} – ${wo.date}`,
      html: `<div style="font-family:Arial;padding:20px;"><h2 style="color:#f44336;">❌ Shop Work Order Disapproved (VOID)</h2><p>Employee: ${wo.employeeNames}</p><p>Date: ${wo.date}</p></div>`,
    }, () => {});

    res.json({ message: 'Disapproved', wo });
  } catch (e) {
    res.status(500).json({ error: 'Error processing disapproval.' });
  }
});

// Get all shop work orders (for admin dashboard)
router.get('/shop-work-orders', async (req, res) => {
  try {
    const { date, month, year } = req.query;
    let query = {};
    if (date) {
      query.date = date;
    } else if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      query.date = { $gte: start, $lt: end };
    }
    const orders = await ShopWorkOrder.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /shop-work-order/:id/admin-edit - Admin edits a shop work order
const EDIT_ALLOWED_EMAILS = new Set([
  'tbsolutions9@gmail.com',
  'tbsolutions4@gmail.com',
  'tbsolutions1999@gmail.com',
  'tbsolutions1995@gmail.com',
  'materialworx2@gmail.com'
]);

router.put('/shop-work-order/:id/admin-edit', express.json(), async (req, res) => {
  try {
    const { edits, adminNotes, editedBy } = req.body;
    if (!editedBy || !EDIT_ALLOWED_EMAILS.has(editedBy)) {
      return res.status(403).json({ error: 'Unauthorized to edit work orders.' });
    }

    const wo = await ShopWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ error: 'Shop work order not found.' });

    const corrections = [];

    if (edits && typeof edits === 'object') {
      for (const [field, newValue] of Object.entries(edits)) {
        const oldValue = wo[field];
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;

        corrections.push({
          field,
          oldValue,
          newValue,
          editedBy,
          editedAt: new Date()
        });

        wo[field] = newValue;
      }
    }

    if (corrections.length > 0) {
      wo.adminCorrections = [...(wo.adminCorrections || []), ...corrections];
    }

    if (adminNotes !== undefined) {
      wo.adminNotes = adminNotes;
      wo.adminNotesBy = editedBy;
      wo.adminNotesAt = new Date();
    }

    // Check 14+ hour flag
    if (wo.inTime && wo.outTime) {
      const [inH, inM] = wo.inTime.split(':').map(Number);
      const [outH, outM] = wo.outTime.split(':').map(Number);
      let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
      if (totalMinutes < 0) totalMinutes += 24 * 60;
      wo.hoursFlag = totalMinutes >= 14 * 60;
    }

    await wo.save();

    return res.json({ message: `Shop work order updated (${corrections.length} field(s) changed)`, workOrder: wo });
  } catch (e) {
    console.error('Admin edit shop work order error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const HydrovacWorkOrder = require('../models/hydrovacWorkOrder');
const { transporter } = require('../utils/emailConfig');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com', 'tbsolutions.work.orders@gmail.com'];

function toDataUri(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
  const buf = fs.readFileSync(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function renderHydrovacWorkOrderHTML(wo) {
  const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
  const conePath = path.join(__dirname, '..', 'public', 'brand', 'tbs-cone.svg');
  const logo = fs.existsSync(logoPath) ? toDataUri(logoPath) : '';
  const cone = fs.existsSync(conePath) ? toDataUri(conePath) : '';

  const totalEngineHours = (wo.engineHoursEnd - wo.engineHoursStart).toFixed(1);
  const totalMiles = wo.mileageEnd - wo.mileageStart;

  const tcSection = wo.trafficControlUsed ? `
    <tr><td class="label">TC Start Time:</td><td>${wo.tcStartTime}</td></tr>
    <tr><td class="label">TC End Time:</td><td>${wo.tcEndTime}</td></tr>
    <tr><td class="label">TC Trucks:</td><td>${(wo.tcTrucks || []).join(', ') || '—'}</td></tr>` : '';

  const sigSection = wo.foremanSignature
    ? `<div class="sig-block"><div class="sig-label">Foreman Signature</div><img class="sig-img" src="data:image/png;base64,${wo.foremanSignature}" alt="Signature"/></div>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Hydrovac Work Order</title>
<style>
  @page { size: Letter; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; color: #222; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); opacity: 0.07; z-index: -1; }
  .watermark img { height: 480px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 18px; }
  .header img { height: 48px; }
  .header h1 { margin: 0; font-size: 20px; }
  .section-title { font-size: 13px; font-weight: bold; background: #1a1a1a; color: #fff; padding: 5px 10px; margin: 14px 0 6px; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  td.label { font-weight: bold; width: 200px; color: #444; }
  .sig-block { margin-top: 18px; border-top: 1px solid #ccc; padding-top: 10px; }
  .sig-label { font-weight: bold; margin-bottom: 6px; }
  .sig-img { max-height: 80px; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
  .notes-box { border: 1px solid #ccc; padding: 10px; min-height: 50px; white-space: pre-wrap; border-radius: 3px; }
</style></head><body>
  <div class="watermark">${cone ? `<img src="${cone}" alt=""/>` : ''}</div>
  <div class="header">
    ${logo ? `<img src="${logo}" alt="TBS"/>` : '<div></div>'}
    <h1>&#x1F69B; Hydrovac Work Order</h1>
  </div>

  <div class="section-title">Job Info</div>
  <table>
    <tr><td class="label">Date:</td><td>${wo.date}</td></tr>
    <tr><td class="label">Coordinator:</td><td>${wo.coordinator}</td></tr>
    <tr><td class="label">CDL Driver:</td><td>${wo.cdlDriver}</td></tr>
    <tr><td class="label">Second Worker:</td><td>${wo.secondWorker}</td></tr>
  </table>

  <div class="section-title">Operations</div>
  <table>
    <tr><td class="label">Extension Pipe:</td><td>${wo.extensionPipeLength} ft</td></tr>
    <tr><td class="label">Times Dumped:</td><td>${wo.timesDumped}</td></tr>
    <tr><td class="label">Utilities / Holes Found:</td><td>${wo.utilitiesFound}</td></tr>
    <tr><td class="label">Arrival at Locate:</td><td>${wo.arrivalAtLocate}</td></tr>
    <tr><td class="label">Back at TBS Shop:</td><td>${wo.arrivalBackAtShop}</td></tr>
  </table>

  <div class="section-title">Hours &amp; Mileage</div>
  <table>
    <tr><td class="label">Engine Hours Start:</td><td>${wo.engineHoursStart}</td></tr>
    <tr><td class="label">Engine Hours End:</td><td>${wo.engineHoursEnd}</td></tr>
    <tr><td class="label">Total Engine Hours:</td><td>${totalEngineHours} hrs</td></tr>
    <tr><td class="label">Mileage Start:</td><td>${wo.mileageStart}</td></tr>
    <tr><td class="label">Mileage End:</td><td>${wo.mileageEnd}</td></tr>
    <tr><td class="label">Total Miles:</td><td>${totalMiles} mi</td></tr>
  </table>

  <div class="section-title">End-of-Day Checklist</div>
  <table>
    <tr><td class="label">Grease Points Checked:</td><td>${wo.greasePointsChecked ? 'Yes' : 'No'}</td></tr>
    <tr><td class="label">Truck Cleaned Out:</td><td>${wo.truckCleanedOut}</td></tr>
    <tr><td class="label">Filter Cleaned:</td><td>${wo.filterCleaned}</td></tr>
    <tr><td class="label">Water Refill:</td><td>${wo.waterRefill}</td></tr>
  </table>

  <div class="section-title">Traffic Control</div>
  <table>
    <tr><td class="label">Traffic Control Used:</td><td>${wo.trafficControlUsed ? 'Yes' : 'No'}</td></tr>
    ${tcSection}
  </table>

  ${wo.notes ? `<div class="section-title">Notes</div><div class="notes-box">${wo.notes}</div>` : ''}

  ${sigSection}
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

function savePdf(id, buffer) {
  const dir = path.join(__dirname, '..', 'pdfs', 'hydrovac-work-orders');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.pdf`), buffer);
}

// POST /hydrovac-work-order
router.post('/hydrovac-work-order', async (req, res) => {
  try {
    const {
      date, coordinator, cdlDriver, secondWorker,
      extensionPipeLength, timesDumped, utilitiesFound,
      engineHoursStart, engineHoursEnd,
      mileageStart, mileageEnd,
      arrivalAtLocate, arrivalBackAtShop,
      greasePointsChecked, truckCleanedOut, filterCleaned, waterRefill,
      trafficControlUsed, tcStartTime, tcEndTime, tcTrucks,
      foremanSignature, notes,
    } = req.body;

    if (!date || !coordinator || !cdlDriver || !secondWorker ||
        timesDumped == null || utilitiesFound == null ||
        !engineHoursStart || !engineHoursEnd || !mileageStart || !mileageEnd ||
        !arrivalAtLocate || !arrivalBackAtShop ||
        !truckCleanedOut || !filterCleaned || !waterRefill || !foremanSignature) {
      return res.status(400).json({ error: 'All required fields must be filled out.' });
    }

    const wo = await HydrovacWorkOrder.create({
      date, coordinator, cdlDriver, secondWorker,
      extensionPipeLength: Number(extensionPipeLength) || 100,
      timesDumped: Number(timesDumped),
      utilitiesFound: Number(utilitiesFound),
      engineHoursStart: Number(engineHoursStart),
      engineHoursEnd: Number(engineHoursEnd),
      mileageStart: Number(mileageStart),
      mileageEnd: Number(mileageEnd),
      arrivalAtLocate, arrivalBackAtShop,
      greasePointsChecked: Boolean(greasePointsChecked),
      truckCleanedOut, filterCleaned, waterRefill,
      trafficControlUsed: Boolean(trafficControlUsed),
      tcStartTime: trafficControlUsed ? (tcStartTime || '') : '',
      tcEndTime: trafficControlUsed ? (tcEndTime || '') : '',
      tcTrucks: trafficControlUsed ? (tcTrucks || []) : [],
      foremanSignature,
      notes: notes || '',
    });

    // Generate and save PDF
    const html = renderHydrovacWorkOrderHTML(wo);
    const pdfBuffer = await generatePdf(html);
    savePdf(wo._id, pdfBuffer);

    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS,
      subject: `Hydrovac Work Order - ${cdlDriver} & ${secondWorker} - ${date}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a1a;padding:20px;text-align:center;">
          <h1 style="color:#fff;margin:0;">&#x1F69B; Hydrovac Work Order Submitted</h1>
        </div>
        <div style="padding:20px;background:#f9f9f9;">
          <p>A new Hydrovac Work Order has been submitted. See the attached PDF for full details.</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;width:200px;">Date:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${date}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Coordinator:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${coordinator}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">CDL Driver:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${cdlDriver}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Second Worker:</td><td style="padding:8px;">${secondWorker}</td></tr>
          </table>
        </div>
      </div>`,
      attachments: [{ filename: `hydrovac-work-order-${date}-${wo._id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    }, (err) => {
      if (err) console.error('Hydrovac WO email error:', err);
    });

    res.status(201).json({ message: 'Hydrovac work order submitted successfully.', id: wo._id });
  } catch (e) {
    console.error('Hydrovac work order submission error:', e);
    res.status(500).json({ error: 'Internal Server Error', details: e.message });
  }
});

// GET /hydrovac-work-order/:id/pdf — download PDF for a specific work order
router.get('/hydrovac-work-order/:id/pdf', async (req, res) => {
  try {
    const wo = await HydrovacWorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found.' });

    const savedPath = path.join(__dirname, '..', 'pdfs', 'hydrovac-work-orders', `${wo._id}.pdf`);
    let pdfBuffer;

    if (fs.existsSync(savedPath)) {
      pdfBuffer = fs.readFileSync(savedPath);
    } else {
      // Regenerate if file was lost
      const html = renderHydrovacWorkOrderHTML(wo);
      pdfBuffer = await generatePdf(html);
      savePdf(wo._id, pdfBuffer);
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="hydrovac-work-order-${wo.date}-${wo._id}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (e) {
    console.error('Hydrovac WO PDF download error:', e);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

// PUT /hydrovac-work-order/:id — save edits, regenerate PDF, email updated PDF
router.put('/hydrovac-work-order/:id', async (req, res) => {
  try {
    const wo = await HydrovacWorkOrder.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!wo) return res.status(404).json({ error: 'Work order not found.' });

    // Regenerate and overwrite saved PDF
    const html = renderHydrovacWorkOrderHTML(wo);
    const pdfBuffer = await generatePdf(html);
    savePdf(wo._id, pdfBuffer);

    // Email updated PDF to notify list
    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS,
      subject: `[UPDATED] Hydrovac Work Order - ${wo.cdlDriver} & ${wo.secondWorker} - ${wo.date}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a1a;padding:20px;text-align:center;">
          <h1 style="color:#fff;margin:0;">&#x1F69B; Hydrovac Work Order Updated</h1>
        </div>
        <div style="padding:20px;background:#f9f9f9;">
          <p>A Hydrovac Work Order has been <strong>edited by an admin</strong>. See the updated PDF attached.</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;width:200px;">Date:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.date}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Coordinator:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.coordinator}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">CDL Driver:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${wo.cdlDriver}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Second Worker:</td><td style="padding:8px;">${wo.secondWorker}</td></tr>
          </table>
        </div>
      </div>`,
      attachments: [{ filename: `hydrovac-work-order-${wo.date}-${wo._id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    }, (err) => {
      if (err) console.error('Hydrovac WO update email error:', err);
    });

    res.json(wo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hydrovac-work-orders?date=YYYY-MM-DD  OR  ?month=M&year=YYYY
router.get('/hydrovac-work-orders', async (req, res) => {
  try {
    const { date, month, year } = req.query;
    let query = {};
    if (date) {
      query.date = date;
    } else if (month && year) {
      const m = String(month).padStart(2, '0');
      const nextMonth = parseInt(month) === 12 ? '01' : String(parseInt(month) + 1).padStart(2, '0');
      const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : year;
      query.date = { $gte: `${year}-${m}-01`, $lt: `${nextYear}-${nextMonth}-01` };
    }
    const orders = await HydrovacWorkOrder.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

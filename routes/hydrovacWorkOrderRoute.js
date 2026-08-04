const express = require('express');
const router = express.Router();
const HydrovacWorkOrder = require('../models/hydrovacWorkOrder');
const { transporter } = require('../utils/emailConfig');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com', 'tbsolutions.work.orders@gmail.com'];

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

    const totalEngineHours = (Number(engineHoursEnd) - Number(engineHoursStart)).toFixed(1);
    const totalMiles = Number(mileageEnd) - Number(mileageStart);

    const tcRows = trafficControlUsed
      ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">TC Start Time:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${tcStartTime}</td></tr>
         <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">TC End Time:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${tcEndTime}</td></tr>
         <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">TC Trucks:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${(tcTrucks || []).join(', ')}</td></tr>`
      : '';

    const notesRow = notes
      ? `<tr><td style="padding:8px;font-weight:bold;">Notes:</td><td style="padding:8px;">${notes}</td></tr>`
      : '';

    const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a1a1a;padding:20px;text-align:center;">
        <h1 style="color:#fff;margin:0;">&#x1F69B; Hydrovac Work Order Submitted</h1>
      </div>
      <div style="padding:20px;background:#f9f9f9;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;width:200px;">Date:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${date}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Coordinator:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${coordinator}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">CDL Driver:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${cdlDriver}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Second Worker:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${secondWorker}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Extension Pipe:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${extensionPipeLength || 100} ft</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Times Dumped:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${timesDumped}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Utilities/Holes Found:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${utilitiesFound}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Engine Hours:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${engineHoursStart} to ${engineHoursEnd} (${totalEngineHours} hrs)</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Mileage:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${mileageStart} to ${mileageEnd} (${totalMiles} mi)</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Arrival at Locate:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${arrivalAtLocate}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Back at Shop:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${arrivalBackAtShop}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Grease Points Checked:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${greasePointsChecked ? 'Yes' : 'No'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Truck Cleaned Out:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${truckCleanedOut}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Filter Cleaned:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${filterCleaned}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Water Refill:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${waterRefill}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Traffic Control Used:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${trafficControlUsed ? 'Yes' : 'No'}</td></tr>
          ${tcRows}
          ${notesRow}
        </table>
      </div>
    </div>`;

    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS,
      subject: `Hydrovac Work Order - ${cdlDriver} & ${secondWorker} - ${date}`,
      html: emailHtml,
    }, (err) => {
      if (err) console.error('Hydrovac WO email error:', err);
    });

    res.status(201).json({ message: 'Hydrovac work order submitted successfully.', id: wo._id });
  } catch (e) {
    console.error('Hydrovac work order submission error:', e);
    res.status(500).json({ error: 'Internal Server Error', details: e.message });
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


const express = require('express');
const router = express.Router();
const cors = require('cors');
const WorkOrder = require('../models/workorder');
const ControlUser = require('../models/controluser');
const transporter = require('../utils/emailConfig');

// Update this to your prod domain(s)
router.use(cors({ credentials: true, origin: [
  'http://localhost:5173',
  'https://www.trafficbarriersolutions.com'
]}));

// Create Work Order
router.post('/work-order', async (req, res) => {
  try {
    const {
      jobId,
      scheduledDate,
      basic,
      foremanSignature, // base64 (no prefix)
      tbs,
      mismatch
    } = req.body;

    if (!jobId) return res.status(400).json({ error: 'jobId is required' });
    if (!scheduledDate) return res.status(400).json({ error: 'scheduledDate is required' });

    // Verify job exists and contains the date
    const job = await ControlUser.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Basic required fields check
    const reqBasic = ['dateOfJob','client','coordinator','project','address','city','state','zip','startTime','endTime'];
    if (!basic || !reqBasic.every(k => String(basic[k] || '').trim() !== '')) {
      return res.status(400).json({ error: 'Missing required basic fields' });
    }

    if (!foremanSignature) return res.status(400).json({ error: 'Foreman signature is required' });

    // TBS checks
    if (!tbs?.flagger1?.trim() || !tbs?.flagger2?.trim()) {
      return res.status(400).json({ error: 'First two flaggers are required' });
    }

    const m = tbs?.morning || {};
    const keys = ['hardHats','vests','walkies','arrowBoards','cones','barrels','signStands','signs'];
    if (!keys.every(k => m[k]?.start !== undefined && m[k]?.end !== undefined)) {
      return res.status(400).json({ error: 'All morning checklist fields are required' });
    }

    const js = tbs?.jobsite || {};
    const firstFiveOk = js.visibility && js.communication && js.siteForeman && js.signsAndStands && js.conesAndTaper;
    if (!firstFiveOk) return res.status(400).json({ error: 'First 5 jobsite checklist items are required' });

    // Server-side mismatch check
    const mismatchServer = keys.some(k => Number(m[k].start) !== Number(m[k].end));
    if (mismatchServer && !js.equipmentLeft) {
      return res.status(400).json({ error: 'Equipment Left After Hours must be checked when counts mismatch' });
    }

    const scheduled = new Date(scheduledDate + 'T00:00:00Z');

    const created = await WorkOrder.create({
      job: job._id,
      scheduledDate: scheduled,
      basic,
      foremanSignature,
      tbs,
      mismatch: !!(mismatch || mismatchServer)
    });

    // ——— Email Work Order ———
    const userEmail = 'tbsolutions4@gmail.com';
    const mainEmail = 'tbsolutions3@gmail.com';
    const invoiceEmail = 'trafficandbarriersolutions.ap@gmail.com';
    const myEmail = 'tbsolutions9@gmail.com';
    const foremanmail = 'tbsolutions77@gmail.com';
    const damienemail = 'tbsolutions14@gmail.com';

    const fmt = (d) => new Date(d).toLocaleDateString('en-US');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#000">
        <h2 style="background:#efad76;padding:10px 12px;border-radius:6px">Work Order Submitted</h2>
        <p><strong>Date of Job:</strong> ${basic.dateOfJob}</p>
        <p><strong>Client:</strong> ${basic.client}</p>
        <p><strong>Coordinator:</strong> ${basic.coordinator}</p>
        <p><strong>Project/Task:</strong> ${basic.project}</p>
        <p><strong>Job Site:</strong> ${basic.address}, ${basic.city}, ${basic.state} ${basic.zip}</p>
        <p><strong>Time:</strong> ${basic.startTime} – ${basic.endTime}</p>
        ${basic.rating ? `<p><strong>Rating:</strong> ${basic.rating}</p>` : ''}
        ${basic.notice24 ? `<p><strong>24 Hour Notice:</strong> ${basic.notice24}</p>` : ''}
        ${basic.callBack ? `<p><strong>Call Back:</strong> ${basic.callBack}</p>` : ''}
        ${basic.notes ? `<p><strong>Notes:</strong> ${basic.notes}</p>` : ''}

        <h3>Flaggers</h3>
        <ul>
          <li>${tbs.flagger1}</li>
          <li>${tbs.flagger2}</li>
          ${tbs.flagger3 ? `<li>${tbs.flagger3}</li>` : ''}
          ${tbs.flagger4 ? `<li>${tbs.flagger4}</li>` : ''}
          ${tbs.flagger5 ? `<li>${tbs.flagger5}</li>` : ''}
        </ul>

        <h3>Trucks</h3>
        <p>${(tbs.trucks || []).join(', ') || '—'}</p>

        <h3>Morning Checklist</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><th>Item</th><th>Started</th><th>Ended</th></tr>
          ${keys.map(k => `<tr><td>${k}</td><td>${m[k].start}</td><td>${m[k].end}</td></tr>`).join('')}
        </table>
        ${ (mismatchServer ? '<p style="color:#B45309">⚠️ Counts mismatch detected.</p>' : '') }

        <h3>Jobsite Checklist</h3>
        <ul>
          <li>Visibility: ${js.visibility ? 'Yes' : 'No'}</li>
          <li>Communication with Job: ${js.communication ? 'Yes' : 'No'}</li>
          <li>Site Foreman: ${js.siteForeman ? 'Yes' : 'No'}</li>
          <li>Signs and Stands Put Out: ${js.signsAndStands ? 'Yes' : 'No'}</li>
          <li>Cones/Barrels and Taper: ${js.conesAndTaper ? 'Yes' : 'No'}</li>
          <li>Equipment Left After Hours: ${js.equipmentLeft ? 'Yes' : 'No'}</li>
        </ul>

        <h3>Job Site Foreman Signature</h3>
        <img src="cid:foremanSig" alt="Foreman Signature" style="border:1px solid #ddd;max-width:480px" />
      </div>
    `;

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: [invoiceEmail],
      cc: [],
      bcc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
        { name: 'Carson Speer', address: userEmail },
        { name: 'Bryson Davis', address: mainEmail },
        { name: 'Salvador Gonzalez', address: foremanmail },
        { name: 'Damien Diskey', address: damienemail }
      ],
      subject: `WORK ORDER – ${basic.client} – ${basic.dateOfJob}`,
      html,
      attachments: [{
        filename: 'foreman-signature.png',
        content: Buffer.from(foremanSignature, 'base64'),
        cid: 'foremanSig',
        contentType: 'image/png'
      }]
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

module.exports = router;
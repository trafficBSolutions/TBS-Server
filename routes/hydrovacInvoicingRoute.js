const express = require('express');
const router = express.Router();
const HydrovacInvoice = require('../models/hydrovacInvoice');
const { transporter7 } = require('../utils/emailConfig');

const FROM_EMAIL = process.env.EMAIL_USER_7 || 'trafficandbarriersolutions.ap@gmail.com';

// ── POST /api/hydrovac-invoicing/send ────────────────────────────────────────
// Creates invoice record and emails client with invoice + WO PDF link
router.post('/send', async (req, res) => {
  try {
    const {
      workOrderId, client, clientEmail, invoiceNumber, invoiceDate,
      notes, rows, total, woPdfUrl, woData,
    } = req.body;

    if (!workOrderId) return res.status(400).json({ message: 'workOrderId required' });
    if (!client)      return res.status(400).json({ message: 'client required' });
    if (!clientEmail) return res.status(400).json({ message: 'clientEmail required' });
    if (!invoiceNumber) return res.status(400).json({ message: 'invoiceNumber required' });

    const invoice = await HydrovacInvoice.create({
      workOrderId, invoiceNumber, invoiceDate, client, clientEmail,
      rows: rows || [], total: Number(total) || 0,
      notes: notes || '', woPdfUrl: woPdfUrl || '',
      woData: woData || {},
    });

    // Build line items HTML
    const rowsHtml = (rows || []).map(r =>
      `<tr>
        <td style="padding:8px 12px;border:1px solid #ddd;">${r.description || ''}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">$${Number(r.amount || 0).toFixed(2)}</td>
      </tr>`
    ).join('');

    const fmtTime = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':');
      const hr = parseInt(h);
      return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'PM' : 'AM'}`;
    };

    const wo = woData || {};
    const engineHrs = wo.engineHoursStart != null && wo.engineHoursEnd != null
      ? (wo.engineHoursEnd - wo.engineHoursStart).toFixed(1) : '—';
    const miles = wo.mileageStart != null && wo.mileageEnd != null
      ? wo.mileageEnd - wo.mileageStart : '—';

    const html = `
<html>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
  <div style="max-width:640px;margin:auto;background:#fff;padding:24px;border-radius:8px;">

    <h1 style="text-align:center;background:#1a1a1a;color:#fff;padding:16px;border-radius:6px;margin:0 0 20px;">
      🚛 Hydrovac Invoice — ${client}
    </h1>

    <div style="background:#f9f9f9;padding:14px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:4px 0;"><strong>Invoice #:</strong> ${invoiceNumber}</p>
      <p style="margin:4px 0;"><strong>Invoice Date:</strong> ${invoiceDate || new Date().toLocaleDateString()}</p>
      <p style="margin:4px 0;"><strong>Client:</strong> ${client}</p>
    </div>

    <!-- Work Order Summary -->
    <h3 style="background:#e53935;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">
      Work Order Summary — ${wo.date || ''}
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;width:50%;">CDL Driver</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.cdlDriver || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Second Worker</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.secondWorker || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.coordinator || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Engine Hours</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.engineHoursStart} → ${wo.engineHoursEnd} (${engineHrs} hrs)</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Mileage</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.mileageStart} → ${wo.mileageEnd} (${miles} mi)</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Arrival at Locate</td><td style="padding:6px 10px;border:1px solid #ddd;">${fmtTime(wo.arrivalAtLocate)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Back at Shop</td><td style="padding:6px 10px;border:1px solid #ddd;">${fmtTime(wo.arrivalBackAtShop)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Times Dumped</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.timesDumped}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Utilities Found</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.utilitiesFound}</td></tr>
      ${wo.notes ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Notes</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.notes}</td></tr>` : ''}
    </table>

    <!-- Line Items -->
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Invoice Line Items</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <thead>
        <tr style="background:#17365D;color:#fff;">
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:left;">Description</th>
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:right;width:120px;">Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f0f0f0;font-weight:bold;">
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">TOTAL</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">$${Number(total || 0).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    ${notes ? `<div style="margin-bottom:20px;padding:12px 16px;background:#fffbe6;border-left:4px solid #f0ad4e;border-radius:0 6px 6px 0;"><strong>Notes:</strong><p style="margin:6px 0 0;font-style:italic;">${notes}</p></div>` : ''}

    ${woPdfUrl ? `<div style="text-align:center;margin-bottom:20px;"><a href="${woPdfUrl}" style="display:inline-block;padding:10px 20px;background:#e53935;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">📄 View Hydrovac Work Order PDF</a></div>` : ''}

    <div style="text-align:center;border-top:2px solid #1a1a1a;padding-top:16px;margin-top:24px;">
      <p style="margin:4px 0;font-weight:bold;">Traffic &amp; Barrier Solutions, LLC</p>
      <p style="margin:4px 0;">1999 Dews Pond Rd SE, Calhoun, GA 30701</p>
      <p style="margin:4px 0;">Phone: (706) 263-0175</p>
    </div>
  </div>
</body>
</html>`;

    await transporter7.sendMail({
      from: FROM_EMAIL,
      to: clientEmail,
      subject: `Hydrovac Invoice ${invoiceNumber} — ${client}`,
      html,
    });

    res.status(201).json(invoice);
  } catch (e) {
    console.error('[hydrovac-invoicing/send] error:', e);
    res.status(500).json({ message: 'Failed to send invoice', error: e.message });
  }
});

// ── GET /api/hydrovac-invoicing ──────────────────────────────────────────────
// Returns all hydrovac invoices, newest first
router.get('/', async (req, res) => {
  try {
    const invoices = await HydrovacInvoice.find().sort({ createdAt: -1 }).lean();
    res.json(invoices);
  } catch (e) {
    console.error('[hydrovac-invoicing GET] error:', e);
    res.status(500).json({ message: 'Failed to fetch invoices', error: e.message });
  }
});

// ── PATCH /api/hydrovac-invoicing/:id/pay ────────────────────────────────────
// Marks an invoice as paid with a payment method
router.patch('/:id/pay', async (req, res) => {
  try {
    const { payMethod } = req.body;
    const invoice = await HydrovacInvoice.findByIdAndUpdate(
      req.params.id,
      { $set: { payStatus: 'paid', payMethod: payMethod || 'check' } },
      { new: true }
    ).lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (e) {
    console.error('[hydrovac-invoicing PATCH pay] error:', e);
    res.status(500).json({ message: 'Failed to mark paid', error: e.message });
  }
});

module.exports = router;

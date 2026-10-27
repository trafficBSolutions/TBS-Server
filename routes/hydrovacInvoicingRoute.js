const express = require('express');
const router = express.Router();
const HydrovacInvoice = require('../models/hydrovacInvoice');
const { transporter } = require('../utils/emailConfig');
const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

const FROM_EMAIL = process.env.EMAIL_USER || 'tbsolutions9@gmail.com';

// Fetch a remote URL into a Buffer
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Generate invoice PDF buffer from HTML via puppeteer
async function generateInvoicePdf(html) {
  const opts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch(opts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
  } finally {
    await browser.close();
  }
}

// Build invoice PDF HTML — supports multiple WOs
function buildInvoiceHtml({ invoiceNumber, invoiceDate, client, rows, total, notes, wosArr }) {
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'PM' : 'AM'}`;
  };

  const woSectionsHtml = (wosArr || []).map((wo, i) => {
    const engineHrs = wo.engineHoursStart != null && wo.engineHoursEnd != null
      ? (wo.engineHoursEnd - wo.engineHoursStart).toFixed(1) : '—';
    const miles = wo.mileageStart != null && wo.mileageEnd != null
      ? wo.mileageEnd - wo.mileageStart : '—';
    return `
<div class="section-title">Work Order ${wosArr.length > 1 ? `#${i + 1} — ` : '— '}${wo.date || ''}</div>
<table>
  <tr><td class="label">CDL Driver</td><td>${wo.cdlDriver || '—'}</td><td class="label">Second Worker</td><td>${wo.secondWorker || '—'}</td></tr>
  <tr><td class="label">Coordinator</td><td>${wo.coordinator || '—'}</td><td class="label">Date</td><td>${wo.date || '—'}</td></tr>
  <tr><td class="label">Engine Hours</td><td>${wo.engineHoursStart} → ${wo.engineHoursEnd} (${engineHrs} hrs)</td><td class="label">Mileage</td><td>${wo.mileageStart} → ${wo.mileageEnd} (${miles} mi)</td></tr>
  <tr><td class="label">Arrival at Locate</td><td>${fmtTime(wo.arrivalAtLocate)}</td><td class="label">Back at Shop</td><td>${fmtTime(wo.arrivalBackAtShop)}</td></tr>
  <tr><td class="label">Times Dumped</td><td>${wo.timesDumped}</td><td class="label">Utilities Found</td><td>${wo.utilitiesFound}</td></tr>
  ${wo.trafficControlUsed ? `<tr><td class="label">Traffic Control</td><td colspan="3">${wo.tcStartTime || ''} – ${wo.tcEndTime || ''}${wo.tcTrucks?.length ? ' | Trucks: ' + wo.tcTrucks.join(', ') : ''}</td></tr>` : ''}
  ${wo.notes ? `<tr><td class="label">Notes</td><td colspan="3">${wo.notes}</td></tr>` : ''}
</table>`;
  }).join('');

  const rowsHtml = (rows || []).map(r =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #ddd;">${r.description || ''}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">${r.hours != null && r.hours !== '' ? Number(r.hours).toFixed(2) : '\u2014'}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">${r.rate != null && r.rate !== '' ? '$' + Number(r.rate).toFixed(2) : '\u2014'}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">$${Number(r.amount || 0).toFixed(2)}</td>
    </tr>`
  ).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: Letter; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 16px; }
  .company { font-size: 11px; color: #555; line-height: 1.5; }
  .meta { text-align: right; font-size: 12px; }
  .meta strong { font-size: 14px; }
  .section-title { background: #1a1a1a; color: #fff; padding: 5px 10px; font-size: 12px; font-weight: bold; margin: 14px 0 6px; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  td.label { font-weight: bold; width: 200px; color: #444; }
  thead th { background: #ec4d07; color: #fff; padding: 8px 12px; text-align: left; }
  thead th.num { text-align: right; width: 90px; }
  tfoot td { font-weight: bold; background: #f5f5f5; padding: 8px 12px; border-top: 2px solid #ec4d07; }
  tfoot td:last-child { text-align: right; }
  .notes { margin-top: 14px; padding: 10px 14px; background: #fffbe6; border-left: 4px solid #f0ad4e; font-style: italic; font-size: 11px; }
  .footer { margin-top: 24px; border-top: 2px solid #1a1a1a; padding-top: 12px; text-align: center; font-size: 11px; color: #555; }
</style></head><body>

<div class="header">
  <div>
    <h1>🚛 Hydrovac Invoice</h1>
    <div class="company">
      Traffic &amp; Barrier Solutions, LLC<br/>
      P.O. Box 155, Calhoun, GA 30701<br/>
    </div>
  </div>
  <div class="meta">
    <strong>INVOICE</strong><br/>
    Invoice #: ${invoiceNumber}<br/>
    Date: ${invoiceDate || new Date().toLocaleDateString()}<br/>
    <br/>
    <strong>Bill To:</strong><br/>
    ${client}
  </div>
</div>

${woSectionsHtml}

<div class="section-title">Invoice Line Items</div>
<table>
  <thead><tr><th>Description</th><th class="num">Qty / Hours</th><th class="num">$ Per Unit</th><th class="num">Amount</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr><td colspan="3" style="text-align:right;">TOTAL DUE</td><td>$${Number(total || 0).toFixed(2)}</td></tr></tfoot>
</table>

${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ''}

<div class="footer">
  Traffic &amp; Barrier Solutions, LLC &nbsp;|&nbsp; P.O. Box 155, Calhoun, GA 30701
</div>
</body></html>`;
}

// Build email body HTML — supports multiple WOs
function buildEmailHtml({ invoiceNumber, invoiceDate, client, rows, total, notes, wosArr, pdfUrls }) {
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'PM' : 'AM'}`;
  };

  const woTablesHtml = (wosArr || []).map((wo, i) => {
    const engineHrs = wo.engineHoursStart != null && wo.engineHoursEnd != null
      ? (wo.engineHoursEnd - wo.engineHoursStart).toFixed(1) : '—';
    const miles = wo.mileageStart != null && wo.mileageEnd != null
      ? wo.mileageEnd - wo.mileageStart : '—';
    const pdfUrl = pdfUrls && pdfUrls[i];
    return `
    <h3 style="background:#ec4d07;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">
      Work Order ${wosArr.length > 1 ? `#${i + 1} — ` : '— '}${wo.date || ''}
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:${pdfUrl ? '8px' : '20px'};">
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;width:50%;">CDL Driver</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.cdlDriver || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Second Worker</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.secondWorker || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.coordinator || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Engine Hours</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.engineHoursStart} → ${wo.engineHoursEnd} (${engineHrs} hrs)</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Mileage</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.mileageStart} → ${wo.mileageEnd} (${miles} mi)</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Arrival at Locate</td><td style="padding:6px 10px;border:1px solid #ddd;">${fmtTime(wo.arrivalAtLocate)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Back at Shop</td><td style="padding:6px 10px;border:1px solid #ddd;">${fmtTime(wo.arrivalBackAtShop)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Times Dumped</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.timesDumped}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Utilities Found</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.utilitiesFound}</td></tr>
      ${wo.trafficControlUsed ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Traffic Control</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.tcStartTime || ''} – ${wo.tcEndTime || ''}${wo.tcTrucks?.length ? ' | Trucks: ' + wo.tcTrucks.join(', ') : ''}</td></tr>` : ''}
      ${wo.notes ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Notes</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.notes}</td></tr>` : ''}
    </table>
    ${pdfUrl ? `<div style="margin-bottom:20px;"><a href="${pdfUrl}" style="font-size:12px;color:#1565c0;">📄 View Work Order PDF</a></div>` : ''}`;
  }).join('');

  const rowsHtml = (rows || []).map(r =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #ddd;">${r.description || ''}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">${r.hours != null && r.hours !== '' ? Number(r.hours).toFixed(2) : '\u2014'}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">${r.rate != null && r.rate !== '' ? '$' + Number(r.rate).toFixed(2) : '\u2014'}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">$${Number(r.amount || 0).toFixed(2)}</td>
    </tr>`
  ).join('');

  return `
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

    ${woTablesHtml}

    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Invoice Line Items</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <thead>
        <tr style="background:#17365D;color:#fff;">
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:left;">Description</th>
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:right;width:80px;">Qty / Hours</th>
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:right;width:90px;">$ Per Unit</th>
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:right;width:110px;">Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f0f0f0;font-weight:bold;">
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;" colspan="3">TOTAL</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">$${Number(total || 0).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    ${notes ? `<div style="margin-bottom:20px;padding:12px 16px;background:#fffbe6;border-left:4px solid #f0ad4e;border-radius:0 6px 6px 0;"><strong>Notes:</strong><p style="margin:6px 0 0;font-style:italic;">${notes}</p></div>` : ''}

    <div style="text-align:center;border-top:2px solid #1a1a1a;padding-top:16px;margin-top:24px;">
      <p style="margin:4px 0;font-weight:bold;">Traffic &amp; Barrier Solutions, LLC</p>
      <p style="margin:4px 0;">P.O. Box 155, Calhoun, GA 30701</p>
    </div>
  </div>
</body>
</html>`;
}

// ── POST /api/hydrovac-invoicing/send ────────────────────────────────────────
// Accepts single WO (workOrderId/woData/woPdfUrl) OR multiple WOs (workOrderIds[]/wosData[]/woPdfUrls[])
router.post('/send', async (req, res) => {
  try {
    const {
      workOrderIds, wosData, woPdfUrls,   // multi-WO
      workOrderId,  woData,  woPdfUrl,    // legacy single-WO
      client, clientEmail, invoiceNumber, invoiceDate, notes, rows, total,
      images,  // [{ name, dataUrl }] — optional image attachments
    } = req.body;

    // Normalise to arrays
    const woIds   = workOrderIds || (workOrderId ? [workOrderId] : []);
    const wosArr  = wosData      || (woData      ? [woData]      : []);
    const pdfUrls = woPdfUrls    || (woPdfUrl    ? [woPdfUrl]    : []);

    if (!woIds.length)  return res.status(400).json({ message: 'workOrderId(s) required' });
    if (!client)        return res.status(400).json({ message: 'client required' });
    if (!clientEmail)   return res.status(400).json({ message: 'clientEmail required' });
    if (!invoiceNumber) return res.status(400).json({ message: 'invoiceNumber required' });

    const primaryWo = wosArr[0] || {};

    const invoice = await HydrovacInvoice.create({
      workOrderId: woIds[0], workOrderIds: woIds,
      invoiceNumber, invoiceDate, client, clientEmail,
      rows: rows || [], total: Number(total) || 0,
      notes: notes || '',
      woPdfUrl: pdfUrls[0] || '', woPdfUrls: pdfUrls,
      woData: primaryWo, wosData: wosArr,
    });

    // ── Generate invoice PDF ──────────────────────────────────────────────
    const invoiceHtml = buildInvoiceHtml({ invoiceNumber, invoiceDate, client, rows, total, notes, wosArr });
    let invoicePdfBuffer = null;
    try {
      invoicePdfBuffer = await generateInvoicePdf(invoiceHtml);
    } catch (pdfErr) {
      console.error('[hydrovac-invoicing] invoice PDF generation failed:', pdfErr.message);
    }

    // ── Fetch all WO PDFs from Cloudinary ────────────────────────────────
    const safeClient = (client || 'client').replace(/[^a-z0-9]+/gi, '-');
    const attachments = [];

    if (invoicePdfBuffer) {
      attachments.push({
        filename: `hydrovac-invoice-${invoiceNumber}-${safeClient}.pdf`,
        content: invoicePdfBuffer,
        contentType: 'application/pdf',
        contentDisposition: 'attachment',
      });
    }

    for (let i = 0; i < pdfUrls.length; i++) {
      const url = pdfUrls[i];
      if (!url) continue;
      try {
        const buf = await fetchBuffer(url);
        const woDate = (wosArr[i] || {}).date || `wo${i + 1}`;
        attachments.push({
          filename: `hydrovac-work-order-${woDate}-${safeClient}.pdf`,
          content: buf,
          contentType: 'application/pdf',
          contentDisposition: 'attachment',
        });
      } catch (fetchErr) {
        console.error(`[hydrovac-invoicing] WO PDF fetch failed (${url}):`, fetchErr.message);
      }
    }

    // ── Attach images ─────────────────────────────────────────────────────
    if (Array.isArray(images)) {
      images.forEach((img, i) => {
        if (!img?.dataUrl) return;
        // dataUrl format: "data:<mime>;base64,<data>"
        const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return;
        attachments.push({
          filename: img.name || `image-${i + 1}.jpg`,
          content: Buffer.from(match[2], 'base64'),
          contentType: match[1],
          contentDisposition: 'attachment',
        });
      });
    }

    const CC_EMAILS = [
      process.env.EMAIL_USER_7,
      process.env.EMAIL_USER_2,
      process.env.EMAIL_USER_9,
      process.env.EMAIL_USER_8,
    ].filter(Boolean).join(',');

    const html = buildEmailHtml({ invoiceNumber, invoiceDate, client, rows, total, notes, wosArr, pdfUrls });

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: clientEmail,
      cc: CC_EMAILS || undefined,
      subject: `Hydrovac Invoice ${invoiceNumber} — ${client}`,
      html,
      attachments,
    });

    res.status(201).json(invoice);
  } catch (e) {
    console.error('[hydrovac-invoicing/send] error:', e);
    res.status(500).json({ message: 'Failed to send invoice', error: e.message });
  }
});

// ── GET /api/hydrovac-invoicing ──────────────────────────────────────────────
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

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const TcInvoice = require('../models/tcInvoice');
const WorkOrder = require('../models/workorder');
const { transporter7 } = require('../utils/emailConfig');
const puppeteer = require('puppeteer');

const TBS_LOGO_SVG = (() => {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../public/TBS New logo.svg'), 'utf8');
    return raw.replace(/(<svg[^>]*?)\s+width="[^"]*"/, '$1').replace(/(<svg[^>]*?)\s+height="[^"]*"/, '$1');
  } catch { return null; }
})();

const FROM_EMAIL = 'trafficandbarriersolutions.ap@gmail.com';
const CC_EMAIL = 'tbsolutions9@gmail.com';

async function generatePdf(html) {
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

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'PM' : 'AM'}`;
}

function buildInvoiceHtml({ invoiceNumber, invoiceDate, client, clientCompany, clientEmail, clientAddress, clientCity, clientZip, description, projectNumber, rows, total, notes, wosArr }) {
  const woSectionsHtml = (wosArr || []).map((wo, i) => {
    const flaggers = [wo.tbs?.flagger1, wo.tbs?.flagger2, wo.tbs?.flagger3, wo.tbs?.flagger4, wo.tbs?.flagger5]
      .filter(Boolean).join(', ');
    const trucks = (wo.tbs?.trucks || []).join(', ');
    return `
<div class="section-title">Work Order ${wosArr.length > 1 ? `#${i + 1} — ` : '— '}${wo.basic?.dateOfJob || ''}</div>
<table>
  <tr><td class="label">Client</td><td>${wo.basic?.client || '—'}</td><td class="label">Project</td><td>${wo.basic?.project || '—'}</td></tr>
  <tr><td class="label">Coordinator</td><td>${wo.basic?.coordinator || '—'}</td><td class="label">Foreman</td><td>${wo.basic?.foremanName || '—'}</td></tr>
  <tr><td class="label">Start Time</td><td>${fmtTime(wo.basic?.startTime)}</td><td class="label">End Time</td><td>${fmtTime(wo.basic?.endTime)}</td></tr>
  <tr><td class="label">Address</td><td colspan="3">${[wo.basic?.address, wo.basic?.city, wo.basic?.state, wo.basic?.zip].filter(Boolean).join(', ')}</td></tr>
  <tr><td class="label">Flaggers</td><td colspan="3">${flaggers || '—'}</td></tr>
  ${trucks ? `<tr><td class="label">Trucks</td><td colspan="3">${trucks}</td></tr>` : ''}
  ${wo.basic?.notes ? `<tr><td class="label">Notes</td><td colspan="3">${wo.basic.notes}</td></tr>` : ''}
</table>`;
  }).join('');

  const rowsHtml = (rows || []).map(r =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #ddd;word-break:break-word;white-space:normal;max-width:280px;">${r.description || ''}</td>
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
  .section-title { background: #17365D; color: #fff; padding: 5px 10px; font-size: 12px; font-weight: bold; margin: 14px 0 6px; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  td.label { font-weight: bold; width: 160px; color: #444; }
  thead th { background: #17365D; color: #fff; padding: 8px 12px; text-align: left; }
  thead th.num { text-align: right; width: 90px; }
  tfoot td { font-weight: bold; background: #f5f5f5; padding: 8px 12px; border-top: 2px solid #17365D; }
  tfoot td:last-child { text-align: right; }
  .notes { margin-top: 14px; padding: 10px 14px; background: #fffbe6; border-left: 4px solid #f0ad4e; font-style: italic; font-size: 11px; }
  .footer { margin-top: 24px; border-top: 2px solid #1a1a1a; padding-top: 12px; text-align: center; font-size: 11px; color: #555; }
</style></head><body>

<div class="header">
  <div>
    ${TBS_LOGO_SVG ? `<div style="width:120px;margin-bottom:6px;">${TBS_LOGO_SVG}</div>` : '<h1>Traffic Control Invoice</h1>'}
    <div class="company">
      Traffic &amp; Barrier Solutions, LLC<br/>
      P.O. Box 155, Calhoun, GA 30703-0155<br/>
    </div>
  </div>
  <div class="meta">
    <strong>INVOICE</strong><br/>
    TBS Invoice #: ${invoiceNumber}<br/>
    Date: ${invoiceDate || new Date().toLocaleDateString()}<br/>
  </div>
</div>

${woSectionsHtml}

<div class="section-title">Invoice Line Items</div>
<table>
  <thead><tr><th>Description</th><th class="num">Quantity</th><th class="num">Per Unit</th><th class="num">Amount</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr><td colspan="3" style="text-align:right;">TOTAL DUE</td><td>$${Number(total || 0).toFixed(2)}</td></tr></tfoot>
</table>

${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ''}

<table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:12px;">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:16px;">
      <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px 14px;">
        <strong>Bill To:</strong><br/>
        ${clientCompany ? `<strong>Company:</strong> ${clientCompany}<br/>` : ''}
        <strong>Representative:</strong> ${client}<br/>
        <strong>Email:</strong> ${clientEmail}
        ${projectNumber ? `<br/><br/><strong>Project/Task #:</strong> ${projectNumber}` : ''}
      </div>
    </td>
    <td style="width:50%;vertical-align:top;">
      ${clientAddress ? `
      <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px 14px;">
        <strong>Job Site:</strong><br/>
        ${clientAddress}<br/>
        ${(clientCity || clientZip) ? `${clientCity || ''}${clientCity && clientZip ? ', ' : ''}${clientZip || ''}` : ''}
        ${description ? `<br/><em style="color:#555;">${description}</em>` : ''}
      </div>` : ''}
    </td>
  </tr>
</table>

<div class="footer">
  Traffic &amp; Barrier Solutions, LLC &nbsp;|&nbsp; P.O. Box 155, Calhoun, GA 30703-0155
</div>
</body></html>`;
}

function buildEmailHtml({ invoiceNumber, invoiceDate, client, clientCompany, clientAddress, clientCity, clientZip, description, projectNumber, rows, total, notes, wosArr }) {
  const woTablesHtml = (wosArr || []).map((wo, i) => {
    const flaggers = [wo.tbs?.flagger1, wo.tbs?.flagger2, wo.tbs?.flagger3, wo.tbs?.flagger4, wo.tbs?.flagger5]
      .filter(Boolean).join(', ');
    const trucks = (wo.tbs?.trucks || []).join(', ');
    return `
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">
      Work Order ${wosArr.length > 1 ? `#${i + 1} — ` : '— '}${wo.basic?.dateOfJob || ''}
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;width:50%;">Client</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.basic?.client || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Project</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.basic?.project || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.basic?.coordinator || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Foreman</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.basic?.foremanName || '—'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:6px 10px;border:1px solid #ddd;">${fmtTime(wo.basic?.startTime)} – ${fmtTime(wo.basic?.endTime)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Address</td><td style="padding:6px 10px;border:1px solid #ddd;">${[wo.basic?.address, wo.basic?.city, wo.basic?.state, wo.basic?.zip].filter(Boolean).join(', ')}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Flaggers</td><td style="padding:6px 10px;border:1px solid #ddd;">${flaggers || '—'}</td></tr>
      ${trucks ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Trucks</td><td style="padding:6px 10px;border:1px solid #ddd;">${trucks}</td></tr>` : ''}
      ${wo.basic?.notes ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Notes</td><td style="padding:6px 10px;border:1px solid #ddd;">${wo.basic.notes}</td></tr>` : ''}
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

  return `
<html>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
  <div style="max-width:640px;margin:auto;background:#fff;padding:24px;border-radius:8px;">
    <h1 style="text-align:center;background:#17365D;color:#fff;padding:16px;border-radius:6px;margin:0 0 20px;">
      🚦 Traffic Control Invoice — ${client}
    </h1>
    <div style="background:#f9f9f9;padding:14px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:4px 0;"><strong>TBS Invoice #:</strong> ${invoiceNumber}</p>
      ${projectNumber ? `<p style="margin:4px 0;"><strong>Project/Task #:</strong> ${projectNumber}</p>` : ''}
      <p style="margin:4px 0;"><strong>Invoice Date:</strong> ${invoiceDate || new Date().toLocaleDateString()}</p>
      ${clientCompany ? `<p style="margin:4px 0;"><strong>Company:</strong> ${clientCompany}</p>` : ''}
      <p style="margin:4px 0;"><strong>Representative:</strong> ${client}</p>
      ${clientAddress ? `<p style="margin:4px 0;"><strong>Job Site:</strong> ${clientAddress}${clientCity || clientZip ? ', ' + [clientCity, clientZip].filter(Boolean).join(' ') : ''}</p>` : ''}
      ${description ? `<p style="margin:4px 0;"><strong>Description:</strong> ${description}</p>` : ''}
    </div>
    ${woTablesHtml}
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Invoice Line Items</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <thead>
        <tr style="background:#17365D;color:#fff;">
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:left;">Description</th>
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:right;width:80px;">Quantity</th>
          <th style="padding:8px 12px;border:1px solid #4a6fa5;text-align:right;width:90px;">Per Unit</th>
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
    <div style="text-align:center;border-top:2px solid #17365D;padding-top:16px;margin-top:24px;">
      <p style="margin:4px 0;font-weight:bold;">Traffic &amp; Barrier Solutions, LLC</p>
      <p style="margin:4px 0;">P.O. Box 155, Calhoun, GA 30703-0155</p>
    </div>
  </div>
</body>
</html>`;
}

// POST /api/tc-invoicing/send
router.post('/send', async (req, res) => {
  try {
    const {
      workOrderIds, wosData,
      client, clientEmail, clientCompany, clientAddress, clientCity, clientZip,
      description, invoiceNumber, projectNumber, invoiceDate, notes, rows, total,
      images, extraPdfs,
    } = req.body;

    if (!workOrderIds?.length) return res.status(400).json({ message: 'workOrderIds required' });
    if (!client)        return res.status(400).json({ message: 'client required' });
    if (!clientEmail)   return res.status(400).json({ message: 'clientEmail required' });
    if (!invoiceNumber) return res.status(400).json({ message: 'invoiceNumber required' });

    const invoice = await TcInvoice.create({
      workOrderId: workOrderIds[0],
      workOrderIds,
      invoiceNumber, invoiceDate, client, clientCompany, clientEmail,
      clientAddress, clientCity, clientZip, description, projectNumber,
      rows: (rows || []).map(r => ({ description: r.description || '', hours: r.hours ?? '', rate: r.rate ?? '', amount: Number(r.amount) || 0 })),
      notes: notes || '',
      wosData: wosData || [],
      total: Number(total) || 0,
    });

    const invoiceHtml = buildInvoiceHtml({ invoiceNumber, invoiceDate, client, clientCompany, clientEmail, clientAddress, clientCity, clientZip, description, projectNumber, rows, total, notes, wosArr: wosData || [] });
    let invoicePdfBuffer = null;
    try { invoicePdfBuffer = await generatePdf(invoiceHtml); } catch (e) { console.error('[tc-invoicing] PDF err:', e.message); }

    const safeClient = (client || 'client').replace(/[^a-z0-9]+/gi, '-');
    const attachments = [];

    if (invoicePdfBuffer) {
      attachments.push({ filename: `tc-invoice-${invoiceNumber}-${safeClient}.pdf`, content: invoicePdfBuffer, contentType: 'application/pdf', contentDisposition: 'attachment' });
    }

    if (Array.isArray(images)) {
      images.forEach((img, i) => {
        const match = img?.dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return;
        attachments.push({ filename: img.name || `image-${i + 1}.jpg`, content: Buffer.from(match[2], 'base64'), contentType: match[1], contentDisposition: 'attachment' });
      });
    }

    if (Array.isArray(extraPdfs)) {
      extraPdfs.forEach((pdf, i) => {
        const match = pdf?.dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return;
        attachments.push({ filename: pdf.name || `attachment-${i + 1}.pdf`, content: Buffer.from(match[2], 'base64'), contentType: 'application/pdf', contentDisposition: 'attachment' });
      });
    }

    const html = buildEmailHtml({ invoiceNumber, invoiceDate, client, clientCompany, clientAddress, clientCity, clientZip, description, projectNumber, rows, total, notes, wosArr: wosData || [] });

    await transporter7.sendMail({
      from: FROM_EMAIL,
      to: clientEmail,
      cc: CC_EMAIL,
      subject: `Traffic Control Invoice ${invoiceNumber} — ${client}`,
      html,
      attachments,
    });

    res.status(201).json(invoice);
  } catch (e) {
    console.error('[tc-invoicing/send] error:', e);
    res.status(500).json({ message: 'Failed to send invoice', error: e.message });
  }
});

// GET /api/tc-invoicing
router.get('/', async (req, res) => {
  try {
    const invoices = await TcInvoice.find().sort({ createdAt: -1 }).lean();
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch invoices', error: e.message });
  }
});

// PUT /api/tc-invoicing/:id
router.put('/:id', async (req, res) => {
  try {
    const { client, clientEmail, clientCompany, clientAddress, clientCity, clientZip,
            description, invoiceNumber, projectNumber, invoiceDate, notes, rows, total } = req.body;
    const invoice = await TcInvoice.findByIdAndUpdate(
      req.params.id,
      { $set: { client, clientEmail, clientCompany, clientAddress, clientCity, clientZip,
                description, invoiceNumber, projectNumber, invoiceDate, notes,
                rows: (rows || []).map(r => ({ description: r.description || '', hours: r.hours ?? '', rate: r.rate ?? '', amount: Number(r.amount) || 0 })),
                total: Number(total) || 0 } },
      { new: true }
    ).lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (e) {
    res.status(500).json({ message: 'Failed to update invoice', error: e.message });
  }
});

// POST /api/tc-invoicing/:id/resend
router.post('/:id/resend', async (req, res) => {
  try {
    const invoice = await TcInvoice.findById(req.params.id).lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const clientEmail = req.body.clientEmail || invoice.clientEmail;
    const { invoiceNumber, invoiceDate, client, clientCompany, clientAddress, clientCity,
            clientZip, description, projectNumber, rows, total, notes, wosData } = invoice;
    const wosArr = wosData || [];

    const invoiceHtml = buildInvoiceHtml({ invoiceNumber, invoiceDate, client, clientCompany, clientEmail, clientAddress, clientCity, clientZip, description, projectNumber, rows, total, notes, wosArr });
    let invoicePdfBuffer = null;
    try { invoicePdfBuffer = await generatePdf(invoiceHtml); } catch (e) { console.error('[tc-invoicing resend] PDF err:', e.message); }

    const safeClient = (client || 'client').replace(/[^a-z0-9]+/gi, '-');
    const attachments = [];
    if (invoicePdfBuffer) {
      attachments.push({ filename: `tc-invoice-${invoiceNumber}-${safeClient}.pdf`, content: invoicePdfBuffer, contentType: 'application/pdf', contentDisposition: 'attachment' });
    }

    const html = buildEmailHtml({ invoiceNumber, invoiceDate, client, clientCompany, clientAddress, clientCity, clientZip, description, projectNumber, rows, total, notes, wosArr });
    await transporter7.sendMail({
      from: FROM_EMAIL, to: clientEmail, cc: CC_EMAIL,
      subject: `Traffic Control Invoice ${invoiceNumber} — ${client} (Resent)`,
      html, attachments,
    });

    if (clientEmail !== invoice.clientEmail) {
      await TcInvoice.findByIdAndUpdate(req.params.id, { $set: { clientEmail } });
    }

    res.json({ message: `Invoice resent to ${clientEmail}` });
  } catch (e) {
    res.status(500).json({ message: 'Failed to resend invoice', error: e.message });
  }
});

// PATCH /api/tc-invoicing/:id/pay
router.patch('/:id/pay', async (req, res) => {
  try {
    const { payMethod } = req.body;
    const invoice = await TcInvoice.findByIdAndUpdate(
      req.params.id,
      { $set: { payStatus: 'paid', payMethod: payMethod || 'check' } },
      { new: true }
    ).lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (e) {
    res.status(500).json({ message: 'Failed to mark paid', error: e.message });
  }
});

module.exports = router;

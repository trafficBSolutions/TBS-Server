// services/invoiceTemplate.js
const fs = require('fs');
const path = require('path');

function toDataUri(absPath) {
  try {
    if (!fs.existsSync(absPath)) return '';
    const ext = path.extname(absPath).toLowerCase();
    const mime =
      ext === '.png'  ? 'image/png'  :
      ext === '.jpg'  ? 'image/jpeg' :
      ext === '.jpeg' ? 'image/jpeg' :
      ext === '.svg'  ? 'image/svg+xml' : 'application/octet-stream';
    const buf = fs.readFileSync(absPath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function renderInvoiceHTML(workOrder, manualAmount, assets, invoiceData = {}) {
  const formatCurrency = (amount) =>
    `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const serviceRows = invoiceData.sheetRows || [];
  const serviceRowsHTML = serviceRows.map(row => `
    <tr>
      <td>${row.service}</td>
      <td style="text-align:center;">${row.taxed ? 'X' : ''}</td>
      <td style="text-align:right;">${formatCurrency(row.amount)}</td>
    </tr>`).join('');

  const lateInterest = Number(invoiceData.lateInterest || 0);
  const lateSteps    = Number(invoiceData.lateSteps || 0);
  const interestRowHTML = lateInterest > 0 ? `
    <tr>
      <td><strong>Late Interest (2.5% × ${lateSteps} step${lateSteps === 1 ? '' : 's'})</strong></td>
      <td style="text-align:center;">–</td>
      <td style="text-align:right;"><strong>${formatCurrency(lateInterest)}</strong></td>
    </tr>` : '';

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
      <div><strong>${invoiceData.billToCompany || workOrder.basic?.client || ''}</strong></div>
      <div>${invoiceData.billToAddress || [workOrder.basic?.address, workOrder.basic?.city, workOrder.basic?.state, workOrder.basic?.zip].filter(Boolean).join(', ')}</div>
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
      ${serviceRowsHTML || '<tr><td colspan="3" style="text-align:center;font-style:italic;">No services listed</td></tr>'}
      ${interestRowHTML}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatCurrency(invoiceData.sheetSubtotal || manualAmount)}</span></div>
    ${(invoiceData.sheetTaxDue && invoiceData.sheetTaxDue > 0) ? `
    <div class="row"><span>Tax (${invoiceData.sheetTaxRate || 0}%)</span><span>${formatCurrency(invoiceData.sheetTaxDue)}</span></div>` : ''}
    ${(Number.isFinite(invoiceData.sheetOther) && invoiceData.sheetOther !== 0) ? `
    <div class="row"><span>Other</span><span>${formatCurrency(invoiceData.sheetOther)}</span></div>` : ''}
    <div class="row grand"><span>TOTAL</span><span>${formatCurrency(invoiceData.sheetTotal || manualAmount)}</span></div>
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

module.exports = { renderInvoiceHTML, toDataUri };

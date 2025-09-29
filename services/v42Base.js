// services/v42Base.js
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
      ext === '.svg'  ? 'image/svg+xml' :
      'application/octet-stream';
    const buf = fs.readFileSync(absPath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

// === Vertex42-ish house style, shared by all PDFs ===
const V42_CSS = `
:root {
  --tbs-navy:#17365D;
  --tbs-blue:#2F5597;
  --muted:#6b7280;
  --border:#d1d5db;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:20px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
.brand{display:flex;gap:12px;align-items:center;}
.brand img{height:60px;}
.company{font-weight:700;font-size:12px;line-height:1.1;}
.meta{text-align:right;font-size:12px;}
.title{display:flex;align-items:center;gap:10px;justify-content:center;letter-spacing:1px;font-weight:700;font-size:26px;color:var(--tbs-blue);margin:6px 0 10px;}
.title .cone{height:36px;}
.billto-bar{background:var(--tbs-navy);color:#fff;padding:6px 10px;font-weight:700;margin:18px 0 8px;}
.billto{display:flex;gap:16px;justify-content:space-between;font-size:13px;}
.billto .right{display:flex;flex-direction:column;gap:4px;}
.table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}
.table th{background:var(--tbs-navy);color:#fff;text-align:left;padding:8px;font-weight:700;border:1px solid #1f2d44;}
.table td{padding:8px;border:1px solid var(--border);}
.table tr:nth-child(even) td{background:#f9fafb;}
.notes{font-size:12px;color:#111;margin-top:6px;}
.totals{margin-top:14px;width:50%;margin-left:auto;font-size:13px;}
.totals .row{display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #e5e7eb;}
.totals .grand{font-weight:700;border-top:2px solid #111;}
.footer{margin-top:20px;font-size:11.5px;color:#111;border-top:2px solid var(--tbs-navy);padding-top:10px;text-align:center;}
.pill{display:inline-block;border-radius:999px;padding:2px 8px;background:#f2f4f7;border:1px solid #e5e7eb;font-size:11px;}
.small{font-size:12px;color:var(--muted);}
@page{size:A4;margin:18mm;}
`;

// Build the standard header + bill-to bar + content + totals + footer.
// `contentHTML` lets each PDF inject its own center content (service rows OR receipt lines).
function renderV42Document({
  title = 'INVOICE',
  coneDataUri = '',
  logoDataUri = '',
  companyBox = {},
  metaBox = {},
  billTo = {},
  contentHTML = '',
  totalsHTML = '',
  footerHTML = '',
}) {
  const fmt = (v) => (v ?? '').toString();
  const companyHTML = `
    <div class="company">
      <div style="font-size:14px;font-weight:bold;">TBS</div>
      <div>Traffic and Barrier Solutions, LLC</div>
      <div>1999 Dews Pond Rd SE</div>
      <div>Calhoun, GA 30701</div>
      <div>Cell: 706-263-0175</div>
      <div>Email: tbsolutions3@gmail.com</div>
      <div>Website: www.TrafficBarrierSolutions.com</div>
    </div>`;

  const metaHTML = `
    <div class="meta">
      ${metaBox.date ? `<div>DATE: ${fmt(metaBox.date)}</div>` : ''}
      ${metaBox.invoiceNo ? `<div>INVOICE #: ${fmt(metaBox.invoiceNo)}</div>` : ''}
      ${metaBox.wr1 ? `<div>WR#: ${fmt(metaBox.wr1)}</div>` : ''}
      ${metaBox.wr2 ? `<div>WR#: ${fmt(metaBox.wr2)}</div>` : ''}
      ${metaBox.dueDate ? `<div>DUE DATE: ${fmt(metaBox.dueDate)}</div>` : ''}
    </div>`;

  const billToHTML = `
    <div class="billto-bar">BILL TO</div>
    <div class="billto">
      <div class="left">
        <div><strong>${fmt(billTo.company || companyBox.client)}</strong></div>
        <div>${fmt(billTo.address || [companyBox.address, companyBox.city, companyBox.state, companyBox.zip].filter(Boolean).join(', '))}</div>
      </div>
      <div class="right">
        ${billTo.workType ? `<div><strong>Work Type:</strong> ${fmt(billTo.workType)}</div>` : ''}
        ${billTo.foreman ? `<div><strong>Foreman:</strong> ${fmt(billTo.foreman)}</div>` : ''}
        ${billTo.location ? `<div><strong>Job Site Location:</strong> ${fmt(billTo.location)}</div>` : ''}
      </div>
    </div>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><style>${V42_CSS}</style></head>
<body>
  <div class="header">
    <div class="brand">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="TBS Logo"/>` : ''}
      ${companyHTML}
    </div>
    ${metaHTML}
  </div>

  <div class="title">
    ${coneDataUri ? `<img class="cone" src="${coneDataUri}" alt="cone"/>` : ''}
    <span>${title}</span>
  </div>

  ${billToHTML}

  ${contentHTML}

  ${totalsHTML}

  <div class="footer">
    ${footerHTML}
  </div>
</body>
</html>`;
}

function loadStdAssets() {
  // Your current TBSPDF7.png is fine; add the cone svg.
  const logo = toDataUri(path.resolve(__dirname, '../public/TBSPDF7.png'));
  const cone = toDataUri(path.resolve(__dirname, '../public/tbs cone.svg'));
  return { logo, cone };
}

module.exports = { renderV42Document, loadStdAssets, toDataUri };

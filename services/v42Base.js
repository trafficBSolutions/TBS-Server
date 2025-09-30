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

const V42_CSS = `
:root { --tbs-navy:#17365D; --tbs-blue:#2F5597; --muted:#6b7280; --border:#d1d5db; }
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:20px;}

/* ===== HEADER: 3 columns (left info | center cone+TBS | right meta) ===== */
.header{
  display:grid;
  grid-template-columns: 1fr auto 270px;
  align-items:start;
  gap:16px;
  margin-bottom:8px;
}

/* left info block (address etc.) */
.company{font-weight:700;font-size:12px;line-height:1.12;}
.company .name{font-size:26px; font-weight:900; letter-spacing:1px; color:#0b1f3a;}
.company .site{word-break:break-all;}

/* center: cone stacked above TBS wordmark */
.brand-stack{
  display:flex; flex-direction:column; align-items:center; gap:6px; padding:2px 8px;
  max-width:220px;                 /* keeps the stack compact */
}
.brand-stack .cone{
  height:72px;                     /* simple, predictable size */
  max-width:160px;                 /* extra guard */
  width:auto; object-fit:contain;
}
.brand-stack .logo{
  height:60px;                     /* TBSPDF7.png height */
  max-width:180px;                 /* keep narrow so it never exceeds the page */
  width:auto; object-fit:contain;
}

/* right: INVOICE title above meta rows */
.meta{font-size:12px;}
.meta .meta-title{
  text-align:center;
  font-weight:900;
  letter-spacing:1px;
  font-size:28px;
  color:var(--tbs-blue);
  margin-bottom:6px;
}
.meta .box{display:grid; grid-template-columns:auto 1fr; gap:6px 10px;}
.meta .label{color:#0b1f3a; font-weight:700;}
.meta .value{}

/* BILL-TO + TABLE + TOTALS + FOOTER unchanged except minor polish */
.billto-bar{background:var(--tbs-navy);color:#fff;padding:6px 10px;font-weight:700;margin:12px 0 8px;}
.billto{display:flex;gap:16px;justify-content:space-between;font-size:13px;}
.billto .right{display:flex;flex-direction:column;gap:4px;}
.table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}
.table th{background:var(--tbs-navy);color:#fff;text-align:left;padding:8px;font-weight:700;border:1px solid #1f2d44;}
.table td{padding:8px;border:1px solid var(--border);}
.table tr:nth-child(even) td{background:#f9fafb;}

/* section row inside table (e.g., Fully Loaded Vehicle) */
.table .section td{
  background:#e8ecf7;
  color:#0b1f3a;
  font-weight:700;
}

.notes{font-size:12px;color:#111;margin-top:6px;}
.totals{margin-top:14px;width:50%;margin-left:auto;font-size:13px;}
.totals .row{display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #e5e7eb;}
.totals .grand{font-weight:700;border-top:2px solid #111;}
.footer{margin-top:14px;font-size:11.5px;color:#111;border-top:2px solid var(--tbs-navy);padding-top:10px;text-align:center;}
@page{size:A4;margin:18mm;}
`;

/* Single source-of-truth template */
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

  const leftInfo = `
    <div class="company">
      <div class="name">TBS</div>
      <div>Traffic and Barrier Solutions, LLC</div>
      <div>1999 Dews Pond Rd SE</div>
      <div>Calhoun, GA 30701</div>
      <div>Cell: 706-263-0175</div>
      <div>Email: tbsolutions3@gmail.com</div>
      <div class="site">Website: www.TrafficBarrierSolutions.com</div>
    </div>`;
const centerStack = `
  <div class="brand-stack">
    ${coneDataUri ? `<img class="cone" src="${coneDataUri}" alt="cone"/>` : ''}
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="TBS Logo"/>` : ''}
  </div>`;

  const rightMeta = `
    <div class="meta">
      <div class="meta-title">${title}</div>
      <div class="box">
        ${metaBox.date ? `<div class="label">DATE</div><div class="value">${fmt(metaBox.date)}</div>` : ''}
        ${metaBox.invoiceNo ? `<div class="label">INVOICE #</div><div class="value">${fmt(metaBox.invoiceNo)}</div>` : ''}
        ${metaBox.wr1 ? `<div class="label">WR#</div><div class="value">${fmt(metaBox.wr1)}</div>` : ''}
        ${metaBox.wr2 ? `<div class="label">WR#</div><div class="value">${fmt(metaBox.wr2)}</div>` : ''}
        ${metaBox.dueDate ? `<div class="label">DUE DATE</div><div class="value">${fmt(metaBox.dueDate)}</div>` : ''}
      </div>
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
<html><head><meta charset="utf-8"/><style>${V42_CSS}</style></head>
<body>
  <div class="header">
    ${leftInfo}
    ${centerStack}
    ${rightMeta}
  </div>

  ${billToHTML}

  ${contentHTML}

  ${totalsHTML}

  <div class="footer">
    ${footerHTML}
  </div>
</body></html>`;
}

function loadStdAssets() {
  const logo = toDataUri(path.resolve(__dirname, '../public/TBSPDF7.png'));
  const cone = toDataUri(path.resolve(__dirname, '../public/tbs cone.svg'));
  return { logo, cone };
}


module.exports = { renderV42Document, loadStdAssets, toDataUri };

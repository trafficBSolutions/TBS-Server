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
  height:36px;
  max-width:45px;
  width:auto;
  object-fit:contain;
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
/* ===== Right meta: key/value table with bordered value cells ===== */
.meta .box{display:grid; grid-template-columns:auto 1fr; gap:0 10px;}
.meta .row{display:contents;}                     /* lets us lay rows with the grid */
.meta .label{color:#0b1f3a; font-weight:700; text-align:left; padding:6px 0;}
.meta .value{border:1px solid var(--border); min-height:22px; padding:4px 6px;}

/* ===== Split navy heading: Bill To | Job Details (attached) ===== */
.split-bar{
  display:grid; grid-template-columns:1fr 1fr;
  background:var(--tbs-navy); color:#fff; margin:12px 0 0; /* no gap between halves */
}
.split-bar .pane{padding:6px 10px; font-weight:700;}

/* Details area under split bar */
.billto-job-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px; border:1px solid var(--border); border-top:none; padding:10px;}
.billto-job-grid .block{font-size:13px; line-height:1.35;}
.billto-job-grid .kv{display:grid; grid-template-columns:auto 1fr; gap:6px 8px;}
.billto-job-grid .kv .k{font-weight:700;}

/* ===== One-column section with navy title ===== */
.section-title{background:var(--tbs-navy); color:#fff; padding:6px 10px; font-weight:700; margin:14px 0 0;}
.onecol-table{width:100%; border-collapse:collapse; font-size:13px;}
.onecol-table td{border:1px solid var(--border); padding:8px;}
.onecol-table .dotlist{margin:0; padding-left:18px;}
.onecol-table .dotlist li{margin:2px 0;}
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
      ${[
        ['DATE', metaBox.date],
        ['INVOICE #', metaBox.invoiceNo],
        ['WR#', metaBox.wr1],
        ['WR#', metaBox.wr2],
        ['DUE DATE', metaBox.dueDate],
      ].filter(([_, v]) => v !== undefined).map(([k, v]) => `
        <div class="row">
          <div class="label">${k}</div>
          <div class="value">${(v ?? '')}</div>
        </div>
      `).join('')}
    </div>
  </div>`;


const billToHTML = `
  <div class="split-bar">
    <div class="pane">BILL TO</div>
    <div class="pane">JOB DETAILS</div>
  </div>

  <div class="billto-job-grid">
    <!-- Left: Bill To -->
    <div class="block">
      <div><strong>${(billTo.company || companyBox.client || '')}</strong></div>
      <div>${(billTo.address || [companyBox.address, companyBox.city, companyBox.state, companyBox.zip].filter(Boolean).join(', '))}</div>
    </div>

    <!-- Right: Job Details -->
    <div class="block">
      <div class="kv">
        ${billTo.workType ? `<div class="k">Work Type:</div><div>${billTo.workType}</div>` : ''}
        ${billTo.foreman  ? `<div class="k">Foreman:</div><div>${billTo.foreman}</div>` : ''}
        ${billTo.location ? `<div class="k">Job Site:</div><div>${billTo.location}</div>` : ''}
      </div>
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

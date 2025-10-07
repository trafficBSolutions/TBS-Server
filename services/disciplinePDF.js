const path = require('path');
const fs = require('fs');
const { printHtmlToPdfBuffer } = require('./invoicePDF'); // you already have this
const { loadStdAssets } = require('./v42Base');           // if you keep shared assets

function fmt(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US');
}
function esc(s='') {
  return String(s).replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
}

exports.generateDisciplinePdfBuffer = async (doc) => {
  const assets = await loadStdAssets?.() || {}; // optional shared logos/colors
  const logoDataUri = assets.tbsLogoDataUri || '';

  const violationList = (doc.violationTypes || []).join(', ') + (doc.otherViolationText ? ` (Other: ${doc.otherViolationText})` : '');

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Employee Disciplinary Action</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
  .wrap { width: 820px; margin: 0 auto; padding: 20px; }
  .head { display:flex; align-items:center; gap: 12px; margin-bottom: 8px; }
  .logo { height: 42px; }
  h1 { font-size: 20px; margin: 8px 0 16px; }
  .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .box { border: 1px solid #ccc; border-radius: 8px; padding: 10px; margin-bottom: 12px; }
  .label { font-weight: 700; margin-right: 4px; }
  .row { margin-bottom: 6px; }
  .sig-row { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 18px; }
  .sig { height: 64px; border: 1px dashed #bbb; background:#fff; }
  .line { border-bottom: 1px solid #333; height: 22px; margin-top: 34px; }
  .sig-cap { font-size: 11px; margin-top: 4px; text-align:center; }
  .small { font-size: 11px; color: #444; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" />` : ''}
      <div>
        <h1>Employee Disciplinary Action</h1>
        <div class="small">To be signed during the in-office meeting</div>
      </div>
    </div>

    <div class="box grid2">
      <div><span class="label">Employee:</span> ${esc(doc.employeeName)} (${esc(doc.employeeTitle||'')})</div>
      <div><span class="label">Department:</span> ${esc(doc.department||'')}</div>
      <div><span class="label">Issued By (Person Warning):</span> ${esc(doc.issuedByName)} (${esc(doc.issuedByTitle||'')})</div>
      <div><span class="label">Supervisor:</span> ${esc(doc.supervisorName)} (${esc(doc.supervisorTitle||'')})</div>
      <div><span class="label">Incident Date:</span> ${fmt(doc.incidentDate)}</div>
      <div><span class="label">Incident Time:</span> ${esc(doc.incidentTime||'')}</div>
      <div><span class="label">Place:</span> ${esc(doc.incidentPlace||'')}</div>
      <div><span class="label">Violations:</span> ${esc(violationList)}</div>
    </div>

    <div class="box">
      <div class="label">Employee Statement</div>
      <div>${esc(doc.employeeStatement||'')}</div>
    </div>

    <div class="box">
      <div class="label">Employer/Supervisor Statement</div>
      <div>${esc(doc.employerStatement||'')}</div>
    </div>

    <div class="box">
      <div class="label">Warning Decision</div>
      <div>${esc(doc.decision||'')}</div>
      ${doc.meetingDate ? `<div class="row"><span class="label">Meeting Date:</span> ${fmt(doc.meetingDate)}</div>` : ''}
    </div>

    ${(doc.previousWarnings?.length||0) > 0 ? `
    <div class="box">
      <div class="label">Previous Warnings</div>
      <ul>
        ${doc.previousWarnings.map(w => `<li>${esc(w.type)} — ${fmt(w.date)}${w.byWhom ? ` (by ${esc(w.byWhom)})` : ''}</li>`).join('')}
      </ul>
    </div>` : ''}

    <div class="sig-row">
      <div>
        <div class="line"></div>
        <div class="sig-cap">Employee Signature (sign in office)</div>
        <div class="sig-cap small">Date: _____________</div>
      </div>
      <div>
        <div class="line"></div>
        <div class="sig-cap">Signature of Person Warning</div>
        <div class="sig-cap small">Date: _____________</div>
      </div>
      <div>
        <div class="line"></div>
        <div class="sig-cap">Supervisor's Signature</div>
        <div class="sig-cap small">Date: _____________</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return await printHtmlToPdfBuffer(html); // your existing html->pdf helper
};

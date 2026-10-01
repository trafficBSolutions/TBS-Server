const { printHtmlToPdfBuffer, loadTBSLogo } = require('./pdfUtils');

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_LABEL = { OK: '✓ OK', Deficiency: '✗ Deficiency', NA: 'N/A' };
const STATUS_COLOR = { OK: '#2e7d32', Deficiency: '#c0392b', NA: '#888' };

function itemsHTML(items = []) {
  return items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
      <td style="border:1px solid #ddd;padding:6px;font-size:11px">${i + 1}. ${item.label}</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;font-weight:bold;color:${STATUS_COLOR[item.status] || '#333'};font-size:11px">${STATUS_LABEL[item.status] || item.status}</td>
      <td style="border:1px solid #ddd;padding:6px;font-size:11px">${item.correctiveAction || ''}</td>
    </tr>`).join('');
}

function generateJobInspectionHTML(doc) {
  const logo = loadTBSLogo();
  const resultColor = doc.result === 'Pass' ? '#2e7d32' : doc.result === 'WorkStopped' ? '#c0392b' : '#e65100';
  const resultLabel = doc.result === 'Pass' ? '✓ PASS' : doc.result === 'WorkStopped' ? '⛔ WORK STOPPED' : '✗ FAIL';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Daily Jobsite Inspection</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#333;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:12px;border-bottom:3px solid #1e3a8a}
  .logo{max-height:75px;max-width:190px}
  .co-info{text-align:right;font-size:11px;color:#666}
  .title{text-align:center;font-size:20px;font-weight:bold;color:#1e3a8a;margin:12px 0;text-transform:uppercase;letter-spacing:1px}
  .section{margin-bottom:14px;background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #1e3a8a}
  .section-title{font-size:12px;font-weight:bold;color:#1e3a8a;margin-bottom:8px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:3px}
  .two-col{display:flex;gap:16px}
  .two-col .col{flex:1}
  .row{display:flex;margin-bottom:5px}
  .label{font-weight:bold;min-width:140px;color:#555;font-size:11px}
  .val{flex:1;padding-left:8px;font-size:11px}
  .result-badge{display:inline-block;padding:8px 20px;border-radius:6px;font-size:16px;font-weight:bold;color:#fff;background:${resultColor};margin:8px 0}
  .sig-grid{display:flex;gap:30px;margin-top:14px}
  .sig-col{flex:1}
  .sig-line{border-bottom:2px solid #333;height:44px;margin-bottom:4px;font-style:italic;font-size:15px;display:flex;align-items:flex-end;padding-bottom:3px;color:#555}
  .sig-label{font-size:11px;color:#555}
  .footer{margin-top:28px;padding-top:12px;border-top:2px solid #1e3a8a;text-align:center;font-size:10px;color:#666}
</style></head><body>

  <div class="header">
    ${logo ? `<img src="${logo}" alt="TBS Logo" class="logo">` : '<div></div>'}
    <div class="co-info">
      <div><strong>Traffic &amp; Barrier Solutions, LLC</strong></div>
      <div>721 N Wall St, Calhoun, GA 30701</div>
      <div>Phone: (706) 263-0175</div>
      <div>www.trafficbarriersolutions.com</div>
    </div>
  </div>

  <div class="title">TBS Daily Jobsite Inspection Checkoff</div>

  <div class="section">
    <div class="section-title">Inspection Information</div>
    <div class="two-col">
      <div class="col">
        <div class="row"><div class="label">Date:</div><div class="val">${fmtDate(doc.inspectionDate)}</div></div>
        <div class="row"><div class="label">Jobsite:</div><div class="val">${doc.jobsite || ''}</div></div>
      </div>
      <div class="col">
        <div class="row"><div class="label">Inspector:</div><div class="val">${doc.inspector || ''}</div></div>
        <div class="row"><div class="label">Foreman:</div><div class="val">${doc.foreman || ''}</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Inspection Items</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#e9ecef">
          <th style="border:1px solid #ccc;padding:6px;text-align:left">Item</th>
          <th style="border:1px solid #ccc;padding:6px;text-align:center;width:110px">Status</th>
          <th style="border:1px solid #ccc;padding:6px;text-align:left">Corrective Action</th>
        </tr>
      </thead>
      <tbody>${itemsHTML(doc.items)}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Overall Result</div>
    <div class="result-badge">${resultLabel}</div>
    ${doc.result === 'WorkStopped' && doc.stopWorkReason ? `<div style="margin-top:8px;background:#fff;border:1px solid #c0392b;border-radius:4px;padding:8px;font-size:11px"><strong>Stop-Work Reason:</strong> ${doc.stopWorkReason}</div>` : ''}
    ${doc.followUpRequired ? `<div style="margin-top:8px;font-size:11px"><strong>Follow-Up Required:</strong> ${fmtDate(doc.followUpDate) || 'TBD'} &nbsp;|&nbsp; <strong>Completed By:</strong> ${doc.followUpCompletedBy || '___________________'}</div>` : ''}
    ${doc.notes ? `<div style="margin-top:10px;background:#fff;border:1px solid #ddd;border-radius:4px;padding:10px;font-size:11px"><strong>Additional Notes:</strong><br>${doc.notes}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Signatures</div>
    <div class="sig-grid">
      <div class="sig-col">
        <div class="sig-line">${doc.inspectorSignature || ''}</div>
        <div class="sig-label"><strong>Inspector Signature</strong></div>
        <div class="sig-label">${doc.inspector || ''}</div>
        <div style="margin-top:8px;font-size:11px">Date: ${fmtDate(doc.inspectionDate)}</div>
      </div>
      <div class="sig-col">
        <div class="sig-line">${doc.foremanSignature || ''}</div>
        <div class="sig-label"><strong>Foreman Signature</strong></div>
        <div class="sig-label">${doc.foreman || ''}</div>
        <div style="margin-top:8px;font-size:11px">Date: ${fmtDate(doc.inspectionDate)}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div><strong>Traffic &amp; Barrier Solutions, LLC</strong> — Daily Jobsite Inspection Record</div>
    <div>Generated ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} &nbsp;|&nbsp; Record ID: ${doc._id || 'N/A'}</div>
  </div>
</body></html>`;
}

async function generateJobInspectionPdf(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  return await printHtmlToPdfBuffer(generateJobInspectionHTML(plain));
}

module.exports = { generateJobInspectionPdf };

const { printHtmlToPdfBuffer, loadTBSLogo } = require('./pdfUtils');

function fmtTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}

function fmtDate(dateStr) {
  const dt = new Date(dateStr + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function generateHoursHTML({ employeeName, position, weekStart, weekEnd, days, weekTotalMin, purposeTotals }) {
  const logo = loadTBSLogo();
  const weekLabel = `${new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const dayRows = Object.entries(days).map(([dateKey, dayData]) => {
    const records = dayData.records || [];
    const recordRows = records.map(r => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${fmtDate(dateKey)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-size:11px">${fmtTime(r.clockIn)} → ${r.clockOut ? fmtTime(r.clockOut) : '<span style="color:#4CAF50">Active</span>'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-size:11px">${r.purpose || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-size:11px">${r.clockOut ? (r.minutes / 60).toFixed(2) + ' hrs' : '—'}</td>
      </tr>`).join('');
    return recordRows;
  }).join('');

  const purposeRows = Object.entries(purposeTotals).map(([p, mins]) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${p}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-size:11px;font-weight:bold">${(mins / 60).toFixed(2)} hrs (${mins} min)</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Hours Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#333;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #1e3a8a}
  .logo{max-height:70px;max-width:180px}
  .co-info{text-align:right;font-size:11px;color:#666}
  .title{text-align:center;font-size:20px;font-weight:bold;color:#1e3a8a;margin:14px 0;text-transform:uppercase;letter-spacing:1px}
  .section{margin-bottom:18px;background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #1e3a8a}
  .section-title{font-size:12px;font-weight:bold;color:#1e3a8a;margin-bottom:8px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{width:100%;border-collapse:collapse}
  th{background:#e9ecef;border:1px solid #ddd;padding:7px 10px;text-align:left;font-size:11px}
  .footer{margin-top:30px;padding-top:12px;border-top:2px solid #1e3a8a;text-align:center;font-size:10px;color:#666}
  .total-row{background:#dbeafe;font-weight:bold}
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

  <div class="title">Employee Hours Report</div>

  <div class="section">
    <div class="section-title">Employee</div>
    <div><strong>${employeeName}</strong>${position ? ` &nbsp;·&nbsp; ${position}` : ''}</div>
    <div style="margin-top:4px">Week: <strong>${weekLabel}</strong></div>
  </div>

  <div class="section">
    <div class="section-title">Punch Detail</div>
    <table>
      <thead><tr>
        <th>Day</th><th style="text-align:center">In / Out</th><th style="text-align:center">Purpose</th><th style="text-align:center">Hours</th>
      </tr></thead>
      <tbody>
        ${dayRows || '<tr><td colspan="4" style="padding:8px;text-align:center;color:#888">No punches this week</td></tr>'}
        <tr class="total-row">
          <td colspan="3" style="padding:7px 10px;border:1px solid #ddd">Week Total</td>
          <td style="padding:7px 10px;border:1px solid #ddd;text-align:center">${(weekTotalMin / 60).toFixed(2)} hrs</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${Object.keys(purposeTotals).length > 0 ? `
  <div class="section">
    <div class="section-title">Hours by Purpose</div>
    <table>
      <thead><tr><th>Purpose</th><th style="text-align:center">Total Hours</th></tr></thead>
      <tbody>${purposeRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <div><strong>Traffic &amp; Barrier Solutions, LLC</strong> — Confidential Tax / Payroll Record</div>
    <div>Generated on ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}</div>
  </div>
</body></html>`;
}

async function generateHoursPdf(data) {
  return await printHtmlToPdfBuffer(generateHoursHTML(data));
}

module.exports = { generateHoursPdf };

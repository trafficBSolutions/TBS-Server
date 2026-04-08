const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function printHtmlToPdfBuffer(html) {
  let browser;
  try {
    const candidates = [];
    try { const p = await puppeteer.executablePath(); if (p) candidates.push(p); } catch (_) {}
    candidates.push(
      '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser', '/usr/bin/chromium',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );
    if (process.env.PUPPETEER_EXECUTABLE_PATH) candidates.unshift(process.env.PUPPETEER_EXECUTABLE_PATH);

    let executablePath;
    for (const p of candidates) {
      try { if (p && fs.existsSync(p)) { executablePath = p; break; } } catch (_) {}
    }

    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.emulateMediaType('screen');
    return await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' }
    });
  } finally {
    if (browser) try { await browser.close(); } catch (_) {}
  }
}

function loadTBSLogo() {
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  } catch (e) { return ''; }
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function generateDisciplineHTML(doc) {
  const logo = loadTBSLogo();
  const violations = (doc.violationTypes || []).join(', ') + (doc.otherViolationText ? ` — ${doc.otherViolationText}` : '');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Disciplinary Action</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#333;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;padding-bottom:15px;border-bottom:3px solid #1e3a8a}
  .logo{max-height:80px;max-width:200px}
  .co-info{text-align:right;font-size:11px;color:#666}
  .title{text-align:center;font-size:22px;font-weight:bold;color:#1e3a8a;margin:18px 0;text-transform:uppercase;letter-spacing:1px}
  .section{margin-bottom:20px;background:#f8f9fa;padding:14px;border-radius:8px;border-left:4px solid #1e3a8a}
  .section-title{font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:10px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:4px}
  .row{display:flex;margin-bottom:6px}
  .label{font-weight:bold;min-width:180px;color:#555}
  .val{flex:1;padding-left:10px}
  .text-box{background:#fff;padding:10px;border:1px solid #ddd;border-radius:4px;margin-top:5px;white-space:pre-wrap}
  .two-col{display:flex;gap:20px}
  .two-col .col{flex:1}
  table.prev{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
  table.prev th{background:#e9ecef;border:1px solid #ccc;padding:6px;text-align:left}
  .sig-section{margin-top:40px;page-break-inside:avoid}
  .sig-grid{display:flex;flex-wrap:wrap;gap:30px;margin-top:25px}
  .sig-col{flex:1;min-width:200px}
  .sig-line{border-bottom:2px solid #333;margin-bottom:6px;height:50px}
  .sig-label{font-size:11px;color:#555}
  .date-line{border-bottom:1px solid #333;width:140px;display:inline-block;margin-left:8px;height:18px}
  .footer{margin-top:40px;padding-top:15px;border-top:2px solid #1e3a8a;text-align:center;font-size:10px;color:#666}
  .notice{background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:12px;margin-bottom:18px;border-left:4px solid #f39c12}
  .notice b{color:#856404}
</style></head><body>
  <div class="header">
    ${logo ? `<img src="${logo}" alt="TBS Logo" class="logo">` : '<div></div>'}
    <div class="co-info">
      <div><strong>Traffic & Barrier Solutions, LLC</strong></div>
      <div>721 N Wall St, Calhoun, GA 30701</div>
      <div>Phone: (706) 263-0175</div>
      <div>www.trafficbarriersolutions.com</div>
    </div>
  </div>

  <div class="title">Employee Disciplinary Action Form</div>

  <div class="notice">
    <b>NOTICE:</b> This document is an official record of disciplinary action. All parties must sign this form to acknowledge receipt. Signatures are to be obtained in the office on the scheduled meeting date.
  </div>

  <div class="section">
    <div class="section-title">Employee Information</div>
    <div class="two-col">
      <div class="col">
        <div class="row"><div class="label">Employee Name:</div><div class="val">${doc.employeeName || ''}</div></div>
        <div class="row"><div class="label">Position:</div><div class="val">${doc.position || ''}</div></div>
      </div>
      <div class="col">
        <div class="row"><div class="label">Issued By:</div><div class="val">${doc.issuedByName || ''}</div></div>
        <div class="row"><div class="label">Supervisor:</div><div class="val">${doc.supervisorName || ''}</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Incident Details</div>
    <div class="two-col">
      <div class="col">
        <div class="row"><div class="label">Date of Incident:</div><div class="val">${fmtDate(doc.incidentDate)}</div></div>
        <div class="row"><div class="label">Time:</div><div class="val">${doc.incidentTime || ''}</div></div>
      </div>
      <div class="col">
        <div class="row"><div class="label">Place:</div><div class="val">${doc.incidentPlace || ''}</div></div>
      </div>
    </div>
    <div class="row" style="margin-top:8px"><div class="label">Type of Violation:</div><div class="val">${violations || 'N/A'}</div></div>
  </div>

  <div class="section">
    <div class="section-title">Employee Statement</div>
    <p style="font-size:11px;color:#555;margin-bottom:8px">Employee: Please write your statement below.</p>
    <div style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:10px;min-height:120px">
      <div style="border-bottom:1px solid #ddd;height:28px"></div>
      <div style="border-bottom:1px solid #ddd;height:28px"></div>
      <div style="border-bottom:1px solid #ddd;height:28px"></div>
      <div style="border-bottom:1px solid #ddd;height:28px"></div>
    </div>
  </div>

  ${doc.employerStatement ? `
  <div class="section">
    <div class="section-title">Employer / Supervisor Statement</div>
    <div class="text-box">${doc.employerStatement.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Warning Decision & Points</div>
    <div class="two-col">
      <div class="col">
        <div class="row"><div class="label">Points Added:</div><div class="val" style="font-size:16px;font-weight:bold;color:#c0392b">${(doc.points || 0).toFixed(2)}</div></div>
        <div class="row"><div class="label">Previous Points:</div><div class="val">${(doc.previousPoints || 0).toFixed(2)}</div></div>
      </div>
      <div class="col">
        <div class="row"><div class="label">New Total:</div><div class="val" style="font-size:16px;font-weight:bold;color:${(doc.newTotalPoints || 0) >= 3 ? '#c0392b' : '#1e3a8a'}">${(doc.newTotalPoints || 0).toFixed(2)} / 3.00</div></div>
      </div>
    </div>
    ${(doc.newTotalPoints || 0) >= 3 ? '<div style="background:#f8d7da;border:1px solid #f5c6cb;border-radius:6px;padding:10px;margin-top:10px;color:#721c24;font-weight:bold;text-align:center">⚠️ EMPLOYEE HAS REACHED 3.00 POINTS — TERMINATION</div>' : ''}
    ${doc.decision ? `<div class="text-box" style="margin-top:10px">${doc.decision.replace(/\n/g, '<br>')}</div>` : ''}
  </div>

  <div class="sig-section">
    <div class="section-title">Signatures</div>
    <p style="margin-bottom:8px;font-size:11px;color:#555">By signing below, all parties acknowledge that this disciplinary action has been discussed and a copy has been provided to the employee.</p>
    <div class="sig-grid">
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label"><strong>Supervisor Signature</strong></div>
        <div class="sig-label">${doc.supervisorName || ''}</div>
        <div style="margin-top:10px">Date: <span class="date-line"></span></div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label"><strong>Employee Signature</strong></div>
        <div class="sig-label">${doc.employeeName || ''}</div>
        <div style="margin-top:10px">Date: <span class="date-line"></span></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div><strong>Traffic & Barrier Solutions, LLC</strong></div>
    <div>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
    <div>Discipline ID: ${doc._id || 'N/A'}</div>
  </div>
</body></html>`;
}

async function generateDisciplinePdf(doc) {
  return await printHtmlToPdfBuffer(generateDisciplineHTML(doc));
}

module.exports = { generateDisciplinePdf };

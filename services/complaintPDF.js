// services/complaintPDF.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function printHtmlToPdfBuffer(html) {
  let browser;
  try {
    console.log('[pdf] Starting PDF generation...');
    
    const candidates = [];
    try {
      const p = await puppeteer.executablePath();
      if (p) candidates.push(p);
    } catch (_) {}

    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      candidates.unshift(process.env.PUPPETEER_EXECUTABLE_PATH);
    }

    let executablePath = undefined;
    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) { executablePath = p; break; }
      } catch (_) {}
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

    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' }
    });

    return buf;
  } catch (error) {
    console.error('[pdf] PDF generation failed:', error);
    throw error;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

function loadTBSLogo() {
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error loading TBS logo:', error);
    return '';
  }
}

function generateComplaintHTML(complaint) {
  const logoDataUri = loadTBSLogo();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Employee Complaint - ${complaint.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      background: white;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1e3a8a;
    }
    
    .logo {
      max-height: 80px;
      max-width: 200px;
    }
    
    .company-info {
      text-align: right;
      font-size: 11px;
      color: #666;
    }
    
    .title {
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: #1e3a8a;
      margin: 20px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .form-section {
      margin-bottom: 25px;
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #1e3a8a;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #1e3a8a;
      margin-bottom: 12px;
      text-transform: uppercase;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    
    .field-row {
      display: flex;
      margin-bottom: 8px;
      align-items: flex-start;
    }
    
    .field-label {
      font-weight: bold;
      min-width: 140px;
      color: #555;
    }
    
    .field-value {
      flex: 1;
      padding-left: 10px;
      word-wrap: break-word;
    }
    
    .text-area {
      background: white;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 5px;
      white-space: pre-wrap;
    }
    
    .signature-section {
      margin-top: 30px;
      padding: 20px;
      border: 2px solid #1e3a8a;
      border-radius: 8px;
      background: #f0f4ff;
    }
    
    .signature-image {
      max-width: 300px;
      max-height: 100px;
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-top: 10px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #1e3a8a;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 20px;
      border-left: 4px solid #f39c12;
    }
    
    .warning-title {
      font-weight: bold;
      color: #856404;
      margin-bottom: 5px;
    }
    
    .two-column {
      display: flex;
      gap: 20px;
    }
    
    .column {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="TBS Logo" class="logo">` : '<div></div>'}
    <div class="company-info">
      <div><strong>Traffic & Barrier Solutions, LLC</strong></div>
      <div>1995 Dews Pond Rd SE, Calhoun, GA 30701</div>
      <div>Phone: (706) 263-0175</div>
      <div>www.trafficbarriersolutions.com</div>
    </div>
  </div>

  <div class="title">Employee Complaint Form</div>

  <div class="warning-box">
    <div class="warning-title">WARNING</div>
    <div>If you are making a false report, you may be subject to disciplinary action. Honesty and Integrity are fundamental values at TBS.</div>
  </div>

  <div class="form-section">
    <div class="section-title">Employee Information</div>
    <div class="two-column">
      <div class="column">
        <div class="field-row">
          <div class="field-label">Name:</div>
          <div class="field-value">${complaint.name || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Title:</div>
          <div class="field-value">${complaint.title || ''}</div>
        </div>
      </div>
      <div class="column">
        <div class="field-row">
          <div class="field-label">Phone:</div>
          <div class="field-value">${complaint.phone || ''}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Date Submitted:</div>
          <div class="field-value">${complaint.date || ''}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="section-title">Incident Details</div>
    <div class="field-row">
      <div class="field-label">Date of Incident:</div>
      <div class="field-value">${complaint.dateOfIncident || ''}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Location:</div>
      <div class="field-value">${complaint.address || ''}${complaint.city ? ', ' + complaint.city : ''}${complaint.state ? ', ' + complaint.state : ''} ${complaint.zip || ''}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Crew Members:</div>
      <div class="field-value">${complaint.crew || ''}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Person Involved:</div>
      <div class="field-value">${complaint.incidentPersonName || ''}</div>
    </div>
  </div>

  <div class="form-section">
    <div class="section-title">Incident Description</div>
    <div class="text-area">${complaint.incidentDetail || ''}</div>
  </div>

  <div class="form-section">
    <div class="section-title">Additional Information</div>
    <div class="field-row">
      <div class="field-label">First-time Concern:</div>
      <div class="field-value">${complaint.firstTime || ''}</div>
    </div>
    ${complaint.firstTime === 'YES' ? `
    <div class="field-row">
      <div class="field-label">Prior Incidents:</div>
      <div class="field-value">${complaint.priorIncidentCount || '0'}</div>
    </div>
    ` : ''}
    <div class="field-row">
      <div class="field-label">Witnesses:</div>
      <div class="field-value">${complaint.witnesses || ''}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Additional Info:</div>
    </div>
    <div class="text-area">${complaint.message || ''}</div>
  </div>

  <div class="signature-section">
    <div class="section-title">Signature</div>
    <div class="field-row">
      <div class="field-label">Print Name:</div>
      <div class="field-value">${complaint.print || ''}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Signer Name:</div>
      <div class="field-value">${complaint.signatureName || ''}</div>
    </div>
    ${complaint.signatureBase64 ? `
    <div class="field-row">
      <div class="field-label">Signature:</div>
    </div>
    <img src="data:image/png;base64,${complaint.signatureBase64}" alt="Signature" class="signature-image">
    ` : ''}
  </div>

  <div class="footer">
    <div><strong>Traffic & Barrier Solutions, LLC</strong></div>
    <div>This document was generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
    <div>Complaint ID: ${complaint._id || 'N/A'}</div>
  </div>
</body>
</html>`;
}

async function generateComplaintPdf(complaint) {
  const html = generateComplaintHTML(complaint);
  return await printHtmlToPdfBuffer(html);
}

module.exports = {
  generateComplaintPdf,
  printHtmlToPdfBuffer
};

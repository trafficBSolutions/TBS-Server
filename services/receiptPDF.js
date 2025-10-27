// services/receiptPDF.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function printHtmlToPdfBuffer(html) {
  let browser;
  try {
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

function generateReceiptHTML(paymentData) {
  const logoDataUri = loadTBSLogo();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${paymentData.workOrder?.basic?.client || 'Client'}</title>
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
    
    .receipt-section {
      margin-bottom: 25px;
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #28a745;
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
    
    .amount-highlight {
      background: #d4edda;
      padding: 15px;
      border: 2px solid #28a745;
      border-radius: 8px;
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: #155724;
      margin: 20px 0;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #1e3a8a;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    
    .two-column {
      display: flex;
      gap: 20px;
    }
    
    .column {
      flex: 1;
    }
    
    .paid-stamp {
      position: absolute;
      top: 100px;
      right: 50px;
      transform: rotate(-15deg);
      font-size: 48px;
      font-weight: bold;
      color: #28a745;
      border: 4px solid #28a745;
      padding: 10px 20px;
      border-radius: 10px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="paid-stamp">PAID</div>
  
  <div class="header">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="TBS Logo" class="logo">` : '<div></div>'}
    <div class="company-info">
      <div><strong>Traffic & Barrier Solutions, LLC</strong></div>
      <div>1995 Dews Pond Rd SE, Calhoun, GA 30701</div>
      <div>Phone: (706) 263-0175</div>
      <div>www.trafficbarriersolutions.com</div>
    </div>
  </div>

  <div class="title">Payment Receipt</div>

  <div class="receipt-section">
    <div class="section-title">Customer Information</div>
    <div class="two-column">
      <div class="column">
        <div class="field-row">
          <div class="field-label">Company:</div>
          <div class="field-value">${paymentData.workOrder?.basic?.client || 'N/A'}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Project:</div>
          <div class="field-value">${paymentData.workOrder?.basic?.project || 'N/A'}</div>
        </div>
      </div>
      <div class="column">
        <div class="field-row">
          <div class="field-label">Coordinator:</div>
          <div class="field-value">${paymentData.workOrder?.basic?.coordinator || 'N/A'}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Service Date:</div>
          <div class="field-value">${paymentData.workOrder?.scheduledDate ? new Date(paymentData.workOrder.scheduledDate).toLocaleDateString() : 'N/A'}</div>
        </div>
      </div>
    </div>
    <div class="field-row">
      <div class="field-label">Service Address:</div>
      <div class="field-value">${[
        paymentData.workOrder?.basic?.address,
        paymentData.workOrder?.basic?.city,
        paymentData.workOrder?.basic?.state,
        paymentData.workOrder?.basic?.zip
      ].filter(Boolean).join(', ') || 'N/A'}</div>
    </div>
  </div>

  <div class="receipt-section">
    <div class="section-title">Payment Details</div>
    <div class="field-row">
      <div class="field-label">Receipt Number:</div>
      <div class="field-value">${paymentData.receiptNumber || paymentData._id || 'N/A'}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Payment Date:</div>
      <div class="field-value">${new Date(paymentData.paymentDate || Date.now()).toLocaleDateString()}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Payment Method:</div>
      <div class="field-value">${paymentData.paymentMethod === 'card' ? 'Credit/Debit Card' : 'Check'}</div>
    </div>
    ${paymentData.paymentMethod === 'card' && paymentData.cardType ? `
    <div class="field-row">
      <div class="field-label">Card Type:</div>
      <div class="field-value">${paymentData.cardType}</div>
    </div>
    ` : ''}
    ${paymentData.paymentMethod === 'card' && paymentData.cardLast4 ? `
    <div class="field-row">
      <div class="field-label">Card Ending:</div>
      <div class="field-value">****${paymentData.cardLast4}</div>
    </div>
    ` : ''}
    ${paymentData.paymentMethod === 'check' && paymentData.checkNumber ? `
    <div class="field-row">
      <div class="field-label">Check Number:</div>
      <div class="field-value">${paymentData.checkNumber}</div>
    </div>
    ` : ''}
    ${paymentData.stripePaymentIntentId ? `
    <div class="field-row">
      <div class="field-label">Transaction ID:</div>
      <div class="field-value">${paymentData.stripePaymentIntentId}</div>
    </div>
    ` : ''}
  </div>

  <div class="amount-highlight">
    Payment Amount: $${Number(paymentData.paymentAmount || 0).toFixed(2)}
  </div>

  <div class="receipt-section">
    <div class="section-title">Invoice Summary</div>
    <div class="field-row">
      <div class="field-label">Original Amount:</div>
      <div class="field-value">$${Number(paymentData.totalOwed || 0).toFixed(2)}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Payment Applied:</div>
      <div class="field-value">$${Number(paymentData.paymentAmount || 0).toFixed(2)}</div>
    </div>
    <div class="field-row">
      <div class="field-label">Remaining Balance:</div>
      <div class="field-value">$${Math.max(0, Number(paymentData.totalOwed || 0) - Number(paymentData.paymentAmount || 0)).toFixed(2)}</div>
    </div>
    ${Math.max(0, Number(paymentData.totalOwed || 0) - Number(paymentData.paymentAmount || 0)) === 0 ? `
    <div style="margin-top: 10px; padding: 10px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; color: #155724; font-weight: bold; text-align: center;">
      ✓ PAID IN FULL
    </div>
    ` : ''}
  </div>

  <div class="footer">
    <div><strong>Traffic & Barrier Solutions, LLC</strong></div>
    <div>Thank you for your business!</div>
    <div>This receipt was generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
    <div>For questions about this payment, please contact us at (706) 263-0175</div>
  </div>
</body>
</html>`;
}

async function generateReceiptPdf(paymentData) {
  const html = generateReceiptHTML(paymentData);
  return await printHtmlToPdfBuffer(html);
}

module.exports = {
  generateReceiptPdf,
  printHtmlToPdfBuffer
};

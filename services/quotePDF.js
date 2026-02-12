const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function toDataUri(absPath) {
  try {
    if (!fs.existsSync(absPath)) return '';
    const ext = path.extname(absPath).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg';
    const buf = fs.readFileSync(absPath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

async function generateQuotePdf(quoteData) {
  const { date, company, customer, address, city, state, zip, email, phone, rows, computed } = quoteData;

  const tbsLogo = toDataUri(path.resolve(__dirname, '../public/TBSPDF7.svg'));
  const mxLogo = toDataUri(path.resolve(__dirname, '../public/Material WorX Tan.svg'));

  const rowsHTML = rows.map(r => `
    <tr>
      <td>${r.item}</td>
      <td>${r.description}</td>
      <td style="text-align:center;">${r.taxable ? 'Yes' : 'No'}</td>
      <td style="text-align:center;">${r.qty}</td>
      <td style="text-align:right;">$${r.unitPrice.toFixed(2)}</td>
      <td style="text-align:right;">$${(r.qty * r.unitPrice).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
body{font-family:Arial,sans-serif;margin:20px;color:#111;}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #17365D;}
.logos{display:flex;gap:15px;align-items:center;}
.logos img{height:50px;width:auto;}
.title{font-size:24px;font-weight:bold;color:#17365D;}
.info{font-size:12px;margin-bottom:15px;}
.info p{margin:3px 0;}
table{width:100%;border-collapse:collapse;font-size:12px;margin:15px 0;}
th{background:#17365D;color:#fff;padding:8px;text-align:left;}
td{padding:6px;border:1px solid #ddd;}
.totals{text-align:right;margin-top:15px;font-size:13px;}
.totals p{margin:5px 0;}
.grand{font-size:16px;font-weight:bold;}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:11px;color:#555;}
</style>
</head>
<body>
  <div class="header">
    <div class="logos">
      ${tbsLogo ? `<img src="${tbsLogo}" alt="TBS"/>` : ''}
      ${mxLogo ? `<img src="${mxLogo}" alt="Material WorX"/>` : ''}
    </div>
    <div class="title">QUOTE</div>
  </div>

  <div class="info">
    <p><strong>Date:</strong> ${date} | <strong>Customer:</strong> ${customer}</p>
    <p><strong>Company:</strong> ${company}</p>
    <p><strong>Address:</strong> ${address}, ${city}, ${state} ${zip}</p>
    <p><strong>Email:</strong> ${email} | <strong>Phone:</strong> ${phone}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>ITEM</th>
        <th>NOTES</th>
        <th style="text-align:center;">TAX?</th>
        <th style="text-align:center;">QTY</th>
        <th style="text-align:right;">PER UNIT</th>
        <th style="text-align:right;">TOTAL</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  <div class="totals">
    <p>Subtotal: $${computed.subtotal.toFixed(2)}</p>
    <p>Tax: $${computed.taxDue.toFixed(2)}</p>
    ${computed.ccFee > 0 ? `<p>Card Fee: $${computed.ccFee.toFixed(2)}</p>` : ''}
    <p class="grand">TOTAL: $${computed.total.toFixed(2)}</p>
    <p style="color:#d97706;">Deposit (50%): $${computed.depositDue.toFixed(2)}</p>
  </div>

  <div class="footer">
    <p><strong>Traffic & Barrier Solutions, LLC</strong> | 723 N Wall St, Calhoun, GA 30701 | 706-263-0175 | www.trafficbarriersolutions.com</p>
  </div>
</body>
</html>`;

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
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generateQuotePdf };

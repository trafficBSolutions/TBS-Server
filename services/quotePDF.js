const puppeteer = require('puppeteer');
const fs = require('fs');

async function generateQuotePdf(quoteData) {
  const { date, company, customer, address, city, state, zip, email, phone, rows, computed } = quoteData;

  const rowsHTML = rows.map(r => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${r.item}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${r.description}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${r.taxable ? 'Yes' : 'No'}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${r.qty}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${r.unitPrice.toFixed(2)}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${(r.qty * r.unitPrice).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #e7e7e7; }
        .header { background-color: #1dd2ff; padding: 20px; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .info { margin-bottom: 30px; }
        .info p { margin: 5px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #1dd2ff; padding: 10px; text-align: left; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; }
        .totals { text-align: right; margin-top: 30px; }
        .totals p { margin: 8px 0; font-size: 16px; }
        .totals .grand { font-size: 20px; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1dd2ff; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TRAFFIC & BARRIER SOLUTIONS, LLC/MATERIAL WORX</h1>
        <h2>QUOTE</h2>
      </div>
      
      <div class="info">
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Company/Excavator:</strong> ${company}</p>
        <p><strong>Customer:</strong> ${customer}</p>
        <p><strong>Address:</strong> ${address}</p>
        <p><strong>City, State ZIP:</strong> ${city}, ${state} ${zip}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>ITEM</th>
            <th>NOTES</th>
            <th style="text-align: center;">TAX?</th>
            <th style="text-align: center;">QTY</th>
            <th style="text-align: right;">PER UNIT</th>
            <th style="text-align: right;">LINE TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <div class="totals">
        <p><strong>Subtotal:</strong> $${computed.subtotal.toFixed(2)}</p>
        <p><strong>Tax Due:</strong> $${computed.taxDue.toFixed(2)}</p>
        ${computed.ccFee > 0 ? `<p><strong>Card Fee (3.5%):</strong> $${computed.ccFee.toFixed(2)}</p>` : ''}
        <p class="grand">TOTAL: $${computed.total.toFixed(2)}</p>
        <p style="color: #efad76; font-size: 18px;"><strong>Deposit Due (50%):</strong> $${computed.depositDue.toFixed(2)}</p>
      </div>

      <div class="footer">
        <p><strong>Contact Information:</strong></p>
        <p>Bryson C Davis</p>
        <p>Traffic and Barrier Solutions, LLC/Material WorX</p>
        <p>723 N Wall Street, Calhoun, GA 30701</p>
        <p>Cell: 706-263-0175</p>
        <p>Website: www.trafficbarriersolutions.com</p>
      </div>
    </body>
    </html>
  `;

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

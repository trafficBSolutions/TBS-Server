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

module.exports = { printHtmlToPdfBuffer, loadTBSLogo };

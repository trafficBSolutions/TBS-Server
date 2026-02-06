const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function toDataUri(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.svg' ? 'image/svg+xml' :
    'application/octet-stream';
  const buf = fs.readFileSync(absPath);
  const base64 = buf.toString('base64');
  return `data:${mime};base64,${base64}`;
}

function renderHandbookHTML(firstName, lastName, signature, assets) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Employee Handbook Acknowledgment – ${firstName} ${lastName}</title>
<style>
  @page { size: Letter; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.1; z-index: -1; }
  .watermark img { height: 500px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #efad76; padding-bottom: 10px; margin-bottom: 15px; }
  .logo-section img { height: 50px; }
  .title-section h1 { margin: 0; font-size: 24px; }
  .title-section p { margin: 5px 0 0 0; font-size: 12px; }
  .section { margin: 10px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
  .section h3 { margin: 0 0 8px 0; background: #efad76; padding: 5px; border-radius: 3px; font-size: 12px; }
  .field { display: flex; gap: 5px; margin-bottom: 3px; }
  .label { width: 100px; font-weight: bold; font-size: 9px; }
  .value { font-size: 9px; }
  .signature-section { text-align: center; margin-top: 10px; }
  .signature-section img { max-height: 80px; border: 1px solid #ddd; border-radius: 4px; }
</style>
</head>
<body>
  <div class="watermark">
    <img src="${assets.cone}" alt="Watermark" />
  </div>
  <div class="header">
    <div class="logo-section">
      <img src="${assets.logo}" alt="TBS Logo" />
    </div>
    <div class="title-section">
      <h1>Employee Handbook Acknowledgment</h1>
      <p>Date: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
  
  <div class="section">
    <h3>Employee Information</h3>
    <div class="field"><span class="label">Name:</span><span class="value">${firstName} ${lastName}</span></div>
    <div class="field"><span class="label">Date:</span><span class="value">${new Date().toLocaleString()}</span></div>
    <div class="field"><span class="label">Acknowledged:</span><span class="value">Yes</span></div>
  </div>

  <div class="signature-section">
    <h3>Employee Signature</h3>
    <img src="${signature}" alt="Employee Signature" />
    <p><strong>${firstName} ${lastName}</strong></p>
  </div>
</body>
</html>`;
}

async function generateHandbookPdf(firstName, lastName, signature) {
  const conePath = path.join(__dirname, '..', 'public', 'brand', 'tbs-cone.svg');
  const logoPath = path.join(__dirname, '..', 'public', 'TBSPDF7.png');
  const assets = { cone: toDataUri(conePath), logo: toDataUri(logoPath) };

  const html = renderHandbookHTML(firstName, lastName, signature, assets);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(60000);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      timeout: 60000
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

router.post('/api/employee-handbook', async (req, res) => {
  try {
    const { firstName, lastName, signature, hasRead } = req.body;

    if (!firstName || !lastName || !signature || !hasRead) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Extract base64 data from signature
    const base64Data = signature.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate PDF
    const pdfBuffer = await generateHandbookPdf(firstName, lastName, signature);

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: ['tbsolutions1999@gmail.com'],
      bcc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: 'tbsolutions9@gmail.com' },

      ],
      subject: 'Employee Handbook Acknowledgment',
      html: `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">EMPLOYEE HANDBOOK ACKNOWLEDGMENT</h1>
              
              <p>An employee has acknowledged receipt and understanding of the Employee Handbook.</p>
              
              <h3>Employee Information:</h3>
              <ul>
                <li><strong>Name:</strong> ${firstName} ${lastName}</li>
                <li><strong>Acknowledged:</strong> ${hasRead ? 'Yes' : 'No'}</li>
                <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
              </ul>
              
              <h3>Employee Signature:</h3>
              <div style="text-align: center; margin: 10px 0; padding: 10px; border: 1px solid #ddd; background: #f9f9f9;">
                <img src="cid:signature" alt="Employee Signature" style="max-width: 300px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;"/>
              </div>
              
              <hr style="margin: 20px 0;">
              <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `${firstName}_${lastName}_signature.png`,
          content: buffer,
          cid: 'signature'
        },
        {
          filename: `${firstName}_${lastName}_handbook_acknowledgment.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Handbook acknowledgment submitted successfully' });
  } catch (error) {
    console.error('Error submitting handbook acknowledgment:', error);
    res.status(500).json({ error: 'Failed to submit acknowledgment' });
  }
});

module.exports = router;

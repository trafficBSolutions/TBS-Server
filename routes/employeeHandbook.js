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
  const estDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const estDateOnly = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Employee Handbook – ${firstName} ${lastName}</title>
<style>
  @page { size: Letter; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; position: relative; line-height: 1.4; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.1; z-index: -1; }
  .watermark img { height: 500px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #efad76; padding-bottom: 10px; margin-bottom: 15px; }
  .logo-section img { height: 50px; }
  .title-section h1 { margin: 0; font-size: 20px; }
  .title-section p { margin: 5px 0 0 0; font-size: 10px; }
  .section { margin: 8px 0; padding: 6px; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid; }
  .section h3 { margin: 0 0 6px 0; background: #efad76; padding: 4px; border-radius: 3px; font-size: 11px; }
  .section h4 { margin: 8px 0 4px 0; font-size: 10px; }
  .section p, .section ul, .section ol { margin: 4px 0; font-size: 9px; }
  .section ul, .section ol { padding-left: 20px; }
  .signature-section { text-align: center; margin-top: 10px; page-break-before: always; }
  .signature-section img { max-height: 80px; border: 1px solid #ddd; border-radius: 4px; }
  .ack-box { border: 2px solid #efad76; padding: 10px; margin: 10px 0; background: #fff9f0; }
</style>
</head>
<body>
  <div class="watermark"><img src="${assets.cone}" alt="Watermark" /></div>
  
  <div class="header">
    <div class="logo-section"><img src="${assets.logo}" alt="TBS Logo" /></div>
    <div class="title-section">
      <h1>Employee Handbook</h1>
      <p>Traffic & Barrier Solutions, LLC | Effective Date: 01/07/26</p>
    </div>
  </div>

  <div class="section">
    <h3>Table of Contents</h3>
    <ol>
      <li>Welcome & Company Overview</li>
      <li>Employment Policies</li>
      <li>Work Hours, Attendance & Conduct</li>
      <li>Safety & Traffic Control Operations</li>
      <li>Compensation & Benefits</li>
      <li>Discipline & Separation</li>
      <li>Acknowledgment</li>
    </ol>
  </div>

  <div class="section">
    <h3>1. Welcome & Company Overview</h3>
    <p>Welcome to Traffic & Barrier Solutions, LLC, a Georgia-based traffic control services provider dedicated to protecting workers, motorists, pedestrians, and the public. We support roadway construction, utility work, special events, and emergency response by installing and maintaining compliant traffic control systems.</p>
    <p>This handbook outlines general company policies and expectations. It is not an employment contract. Policies may be updated at any time.</p>
  </div>

  <div class="section">
    <h3>2. Employment Policies</h3>
    <h4>Equal Employment Opportunity</h4>
    <p>Traffic & Barrier Solutions, LLC complies with all applicable federal and Georgia employment laws. We do not discriminate based on race, color, religion, sex, national origin, age, disability, veteran status, or any legally protected characteristic.</p>
    <h4>At-Will Employment (Georgia)</h4>
    <p>Employment is at-will, meaning either the employee or the company may end employment at any time, with or without cause or notice.</p>
    <h4>Hiring & Qualifications</h4>
    <p>Employment requires:</p>
    <ul>
      <li>Background checks</li>
      <li>Drug and alcohol testing</li>
      <li>Valid driver's license and driving record (for driving positions)</li>
      <li>Required certifications (e.g., ATSSA Flagger)</li>
    </ul>
    <h4>Introductory Period</h4>
    <p>New hires are subject to a 90-day introductory period.</p>
    <h4>Employee Legal Information & License Updates</h4>
    <p>All employees are required to promptly notify Bryson of any changes to their legal or employment-related information. This includes, but is not limited to:</p>
    <ul>
      <li>Updates, renewals, suspensions, or replacements of a driver's license or professional license</li>
      <li>Legal name changes</li>
      <li>Any other legal changes that may affect employment, payroll, or work authorization</li>
    </ul>
    <p>Employees must provide updated documentation as applicable, including but not limited to:</p>
    <ul>
      <li>A current copy of the updated license, and</li>
      <li>Updated tax or employment forms, such as a W-9 or W-4, when required.</li>
    </ul>
    <p>Failure to notify the company of required changes or to provide updated documentation in a timely manner may result in disciplinary action, up to and including termination of employment.</p>
  </div>

  <div class="section">
    <h3>3. Work Hours, Attendance & Conduct</h3>
    <h4>Work Hours & Overtime</h4>
    <p>Schedules vary by project. Non-exempt employees are paid overtime at 1.5x their regular rate for hours over 40 in a workweek, per federal law. Overtime must be approved in advance.</p>
    <h4>Work Schedules, Communication, and Attendance</h4>
    <p>Reliable attendance is critical in traffic control operations. Employees must notify supervisors as soon as possible if late or absent. Excessive absences may result in discipline.</p>
    <p>Work schedules are issued daily and communicated through GroupMe. Employees are responsible for monitoring GroupMe for scheduling updates and reporting to work as scheduled.</p>
    <p>Employees who are unable to work their assigned shift must notify their supervisor no less than one (1) hour before their scheduled start time. Failure to provide proper notice or repeated attendance issues may result in disciplinary action, up to and including termination.</p>
    <h4>Standards of Conduct</h4>
    <p>Employees are expected to:</p>
    <ul>
      <li>Follow all safety rules and instructions</li>
      <li>Act professionally on job sites</li>
      <li>Treat coworkers, clients, and the public with respect</li>
    </ul>
  </div>

  <div class="section">
    <h3>4. Safety & Traffic Control Operations</h3>
    <h4>Safety Commitment</h4>
    <p>Safety is our highest priority. Employees must comply with:</p>
    <ul>
      <li>MUTCD Part 6 – Temporary Traffic Control</li>
      <li>GDOT requirements</li>
      <li>Company safety policies</li>
    </ul>
    <h4>Personal Protective Equipment (PPE)</h4>
    <p>Required PPE includes:</p>
    <ul>
      <li>Company approved Safety Vest</li>
      <li>TBS-Branded Shirt</li>
      <li>Hard hat</li>
      <li>Boots</li>
      <li>Long Pants (e.g., jeans, khakis, or similar)</li>
      <li>Additional PPE as required by the job</li>
    </ul>
    <h4>Drug- & Alcohol-Free Workplace</h4>
    <p>The use, possession, or impairment from drugs or alcohol during work hours, on job sites, or in company vehicles is prohibited. Testing may occur pre-employment, randomly, post-incident, or for reasonable suspicion.</p>
    <h4>Harassment, Discrimination & Violence</h4>
    <p>Harassment, discrimination, threats, or violence will not be tolerated. Employees should report concerns immediately. Retaliation is prohibited.</p>
    <h4>Vehicle & Equipment Use</h4>
    <ul>
      <li>Company vehicles are for authorized use only</li>
      <li>Daily inspections are required</li>
      <li>Report damage, accidents, or equipment issues immediately to management</li>
    </ul>
    <h4>Traffic Laws, Tolls, and Vehicle Use Liability</h4>
    <p>Employees must comply with all applicable traffic laws, regulations, and toll requirements while operating a company-owned or company-leased vehicle. Employees are solely responsible for any traffic violations, citations, fines, tolls, penalties, administrative fees, or other charges incurred during vehicle use, regardless of whether the violation is issued to the employee or the company.</p>
    <p>This includes, but is not limited to, violations related to speeding, parking, red-light cameras, and the use of toll roads or toll lanes without an authorized transponder or proper payment method. Any costs incurred by the company as a result of such violations may be charged back to the employee or deducted from wages where permitted by applicable law.</p>
    <p>Failure to comply with this policy may result in disciplinary action, up to and including termination.</p>
    <h4>Incident Reporting</h4>
    <p>All accidents, injuries, or near-misses must be reported immediately and documented within 24 hours.</p>
    <h4>Work Order Completion & Authorization (Crew Leaders)</h4>
    <p>All Crew Leaders are required to accurately complete a work order for each assigned job. This includes:</p>
    <ul>
      <li>Submitting the work order through the designated online system, and</li>
      <li>Completing a paper copy when required or applicable.</li>
    </ul>
    <p>All work orders must be reviewed and signed by the Superintendent prior to submission or job closeout, unless otherwise authorized.</p>
    <p>Failure to properly complete, submit, or obtain required authorization on work orders may result in suspension of pay for that job or disciplinary action, up to and including verbal or written warnings, suspension, or termination, in accordance with company disciplinary policies.</p>
  </div>

  <div class="section">
    <h3>5. Compensation & Benefits</h3>
    <h4>Compensation</h4>
    <p>Employees are paid weekly. Compensation for hours worked during each workweek will be issued the following week, in accordance with the company's regular payroll schedule. Required deductions apply if applicable.</p>
    <h4>Expense Reimbursement</h4>
    <p>Approved job-related expenses are reimbursed when submitted in a timely manner with documentation.</p>
  </div>

  <div class="section">
    <h3>6. Discipline & Separation</h3>
    <h4>Discipline</h4>
    <p>Policy violations may result in disciplinary action up to and including termination. Progressive discipline may be used but is not guaranteed.</p>
    <h4>Separation of Employment</h4>
    <p>Employees are encouraged to provide 2 weeks of notice. Final pay will be issued in accordance with Georgia law. All company property, including any provided safety vests, hard hats, and TBS-branded clothing, must be returned.</p>
  </div>

  <div class="section">
    <h3>7. Acknowledgment</h3>
    <p>I acknowledge receipt of the Traffic & Barrier Solutions, LLC Employee Handbook and understand that employment is at-will and that I am responsible for following company policies.</p>
  </div>

  <div class="signature-section">
    <div class="ack-box">
      <h3 style="background: none; padding: 0; margin-bottom: 10px;">Employee Acknowledgment</h3>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Date:</strong> ${estDate}</p>
      <p><strong>Acknowledged:</strong> Yes</p>
    </div>
    <h3 style="background: none; padding: 0;">Employee Signature</h3>
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

    const estDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: ['tbsolutions1999@gmail.com'],
      bcc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: 'tbsolutions9@gmail.com' },
        { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
        { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' }
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
                <li><strong>Date:</strong> ${estDate}</li>
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

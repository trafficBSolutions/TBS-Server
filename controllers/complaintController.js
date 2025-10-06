// controllers/complaintController.js
const path = require('path');
const Complaint = require('../models/complaintuser'); // this should export a model
const { transporter } = require('../utils/emailConfig');  // matches your traffic flow import
const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const foremanmail = 'tbsolutions77@gmail.com';
const damienemail = 'tbsolutions14@gmail.com';
const leah = "trafficandbarriersolutions.ap@gmail.com";
const APP_URL = process.env.APP_URL || 'https://www.trafficbarriersolutions.com';

// tiny helper for required checks
function requireFields(body, fields) {
  const missing = [];
  for (const f of fields) {
    if (body[f] == null || String(body[f]).trim() === '') missing.push(f);
  }
  return missing;
}

// tiny helper to render label/value rows in HTML
function field(label, val) {
  const safe = val ? String(val).replace(/\n/g, '<br>') : '';
  return `
    <tr>
      <td style="padding:6px 10px;"><strong>${label}:</strong></td>
      <td style="padding:6px 10px;">${safe}</td>
    </tr>`;
}

const submitComplaint = async (req, res) => {
  try {
    const {
      name,
      date,
      title,
      phone,
      dateOfIncident,
      address,
      city,
      state,
      zip,
      crew,
      incidentPersonName,
      incidentDetail,
      firstTime,
      priorIncidentCount,
      witnesses,
      message,
      print,
      signatureName,
      signatureBase64
    } = req.body;

    // server-side validation (don’t rely only on FE)
    const required = [
      'name','date','title','phone',
      'dateOfIncident','address','crew',
      'incidentPersonName','incidentDetail',
      'firstTime','witnesses','message',
      'print','signatureName','signatureBase64'
    ];
    const missing = requireFields(req.body, required);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', missing });
    }
    if (firstTime === 'YES') {
      const c = String(priorIncidentCount || '').trim();
      if (!/^\d+$/.test(c)) {
        return res.status(400).json({ error: 'priorIncidentCount must be a whole number when firstTime is YES' });
      }
    }

    // create the document
    const doc = await Complaint.create({
      name,
      date,
      title,
      phone,
      dateOfIncident,
      address,
      city,
      state,
      zip,
      crew,
      incidentPersonName,
      incidentDetail,
      firstTime,
      priorIncidentCount,
      witnesses,
      message,
      print,
      signatureName,
      signatureBase64
    });

    // admin links (adjust to your real admin routes)
    const adminViewLink = `${APP_URL}/admin/complaints/${doc._id}`;
    const adminListLink = `${APP_URL}/admin/complaints`;
    const printLink     = `${APP_URL}/admin/complaints/${doc._id}/print`;

    // HTML email
    const html = `
    <html>
      <body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
        <div style="max-width:700px;margin:auto;background:#fff;padding:20px;border-radius:8px;">
          <h1 style="text-align:center;background:#efad76;padding:15px;border-radius:6px;">
            EMPLOYEE COMPLAINT – NEW SUBMISSION
          </h1>

          <p>A new Employee Complaint was submitted and stored in the system.</p>

          <h3>Summary</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${field('Employee Name', doc.name)}
            ${field("Today's Date", doc.date)}
            ${field('Title', doc.title)}
            ${field('Phone', doc.phone)}
            ${field('Date of Incident', doc.dateOfIncident)}
            ${field('Incident Address', `${doc.address}${doc.city ? ', ' + doc.city : ''}${doc.state ? ', ' + doc.state : ''} ${doc.zip || ''}`)}
            ${field('Crew Member(s)', doc.crew)}
            ${field('Person Involved', doc.incidentPersonName)}
            ${field('First-time Concern', doc.firstTime)}
            ${doc.firstTime === 'YES' ? field('Number of Prior Incidents', doc.priorIncidentCount || '0') : ''}
            ${field('Witnesses', doc.witnesses)}
          </table>

          <h3 style="margin-top:16px;">Incident Description</h3>
          <div style="padding:10px;background:#fafafa;border:1px solid #eee;border-radius:6px;">
            ${String(doc.incidentDetail || '').replace(/\n/g,'<br>')}
          </div>

          <h3 style="margin-top:16px;">Additional Information</h3>
          <div style="padding:10px;background:#fafafa;border:1px solid #eee;border-radius:6px;">
            ${String(doc.message || '').replace(/\n/g,'<br>')}
          </div>

          <h3 style="margin-top:16px;">Signature</h3>
          <p><strong>Printed Name:</strong> ${doc.print}</p>
          <p><strong>Signer Name (typed):</strong> ${doc.signatureName}</p>
          <div>
            <img alt="Signature" src="cid:signatureImage" style="max-width:400px;border:1px solid #ddd;border-radius:4px" />
          </div>

          <hr style="margin:20px 0;">

          <h3>Links</h3>
          <ul>
            <li><a href="${adminViewLink}">Open this Complaint</a></li>
            <li><a href="${adminListLink}">All Complaints</a></li>
            <li><a href="${printLink}">Print (if available)</a></li>
          </ul>

          <hr style="margin:20px 0;">
          <p style="font-size:13px;">
            Traffic &amp; Barrier Solutions, LLC<br>
            1995 Dews Pond Rd SE, Calhoun, GA 30701<br>
            Phone: (706) 263-0175<br>
            <a href="https://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a>
          </p>
        </div>
      </body>
    </html>`;

    // send to internal inbox; add BCCs like your traffic flow if you want
    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: myEmail,
       bcc: [
         { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
              { name: 'Leah Davis', address: leah },
              { name: 'Bryson Davis', address: mainEmail },
      { name: 'Jonkell Tolbert', address: foreemail },
      { name: 'Salvador Gonzalez', address: foremanmail},
      { name: 'Damien Diskey', address: damienemail}
       ],
      subject: `EMPLOYEE COMPLAINT: ${doc.name} – ${doc.dateOfIncident}`,
      html,
      attachments: [
        {
          filename: 'TBSPDF7.png',
          path: path.join(__dirname, '..', 'public', 'TBSPDF7.png'),
          cid: 'tbslogo',
          contentDisposition: 'inline',
          contentType: 'image/png'
        },
        {
          filename: 'signature.png',
          cid: 'signatureImage',
          content: Buffer.from(doc.signatureBase64, 'base64'),
          contentType: 'image/png',
          contentDisposition: 'inline'
        }
      ]
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending complaint email:', error);
      } else {
        console.log('Complaint email sent:', info.response);
      }
    });

    // clean JSON response (no scheduledDates/createdJobs here)
    res.status(201).json({
      message: 'Complaint submitted successfully',
      id: doc._id,
      viewUrl: adminViewLink
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { submitComplaint };

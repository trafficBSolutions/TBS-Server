const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.post('/api/employee-handbook', async (req, res) => {
  try {
    const { firstName, lastName, signature, hasRead } = req.body;

    if (!firstName || !lastName || !signature || !hasRead) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: ['tbsolutions1999@gmail.com'],
      bcc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: 'tbsolutions9@gmail.com' },
        /*
        { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
        { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' }
         */
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
                <img src="${signature}" alt="Employee Signature" style="max-width: 300px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;"/>
              </div>
              
              <hr style="margin: 20px 0;">
              <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Handbook acknowledgment submitted successfully' });
  } catch (error) {
    console.error('Error submitting handbook acknowledgment:', error);
    res.status(500).json({ error: 'Failed to submit acknowledgment' });
  }
});

module.exports = router;

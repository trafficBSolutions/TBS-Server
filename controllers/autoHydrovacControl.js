const HydrovacRequest = require('../models/hydrovacRequest');
const { transporter } = require('../utils/emailConfig');
const axios = require('axios');

const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const foremanmail = 'materialworx2@gmail.com';
const damienemail = 'tbsolutions14@gmail.com';
const submitHydrovac = async (req, res) => {
  try {
    const { first, last, company, email, phone, address, city, state, zip, serviceType, preferredDate, message, token } = req.body;

    if (!token) return res.status(400).json({ error: 'reCAPTCHA token is missing.' });

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: secretKey, response: token }
    });
    if (!data.success || data.score < 0.4) return res.status(400).json({ error: 'Failed reCAPTCHA verification.' });

    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email address' });

    const newRequest = await HydrovacRequest.create({ first, last, company, email, phone, address, city, state, zip, serviceType, preferredDate, message });

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: email,
      cc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
        { name: 'Carson Speer', address: userEmail },
        { name: 'Dasia Diskey', address: foremanmail },
        { name: 'Damien Diskey', address: damienemail }
      ],
      subject: 'HYDROVAC SERVICE REQUEST',
      html: `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">HYDROVAC SERVICE REQUEST</h1>
              <p>Hi <strong>${first} ${last}</strong>,</p>
              <p>Your hydrovac service request has been received! We will contact you within 48 hours.</p>
              <h3>Contact Info:</h3>
              <ul style="padding-left: 20px; margin: 0;">
                <li><strong>Name:</strong> ${first} ${last}</li>
                <li><strong>Company:</strong> ${company}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Phone:</strong> ${phone}</li>
              </ul>
              <h3>Job Site:</h3>
              <ul style="padding-left: 20px; margin: 0;">
                <li>${address}, ${city}, ${state} ${zip}</li>
              </ul>
              <h3>Service Details:</h3>
              <ul style="padding-left: 20px; margin: 0;">
                <li><strong>Service Type:</strong> ${serviceType}</li>
                <li><strong>Preferred Date:</strong> ${preferredDate}</li>
                <li><strong>Message:</strong> ${message}</li>
              </ul>
              <hr style="margin: 20px 0;">
              <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>721 N Wall St, Calhoun, GA 30701<br>Email: materialworx2@gmail.com<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
            </div>
          </body>
        </html>`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.log('Error sending hydrovac email:', err);
      else console.log('Hydrovac email sent:', info.response);
    });

    res.status(201).json({ message: 'Hydrovac request submitted successfully', newRequest });
  } catch (error) {
    console.error('Error submitting hydrovac request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getHydrovacByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const results = await HydrovacRequest.find({ createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 });
    res.json(results);
  } catch (e) {
    console.error('Error fetching monthly hydrovac requests:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getHydrovacByDay = async (req, res) => {
  try {
    const { date } = req.query;
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const results = await HydrovacRequest.find({ createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 });
    res.json(results);
  } catch (e) {
    console.error('Error fetching daily hydrovac requests:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { submitHydrovac, getHydrovacByMonth, getHydrovacByDay };

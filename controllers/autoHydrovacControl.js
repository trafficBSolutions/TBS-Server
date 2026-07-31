const HydrovacRequest = require('../models/hydrovacRequest');
const { transporter } = require('../utils/emailConfig');
const axios = require('axios');

const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions1999@gmail.com';
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
        { name: 'Bryson Davis', address: mainEmail },
        { name: 'Bryson Davis', address: foreemail },
        { name: 'Dasia Diskey', address: foremanmail },
        { name: 'Damien Diskey', address: damienemail }
      ],
      subject: 'HYDROVAC SERVICE REQUEST',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#e7e7e7;">
          <header style="background-color:#efad76;">
            <h2 style="margin-top:20px;font-size:50px;text-align:center;font-family:Arial,sans-serif;color:#000;">TRAFFIC & BARRIER SOLUTIONS, LLC</h2>
          </header>
          <h2 style="margin-top:20px;font-size:40px;text-align:center;color:#000;">HYDROVAC SERVICE REQUEST</h2>
          <div style="padding:20px;">
            <h1 style="font-family:Arial,sans-serif;">Dear ${first},</h1>
            <h1 style="font-family:Arial,sans-serif;">Your hydrovac service request has been received! We will contact you within 48 hours.</h1>
            <h2 style="margin-top:30px;font-size:30px;color:#000;">Contact Info:</h2>
            <p style="font-size:20px;"><strong>Name:</strong> ${first} ${last}</p>
            <p style="font-size:20px;"><strong>Company:</strong> ${company}</p>
            <p style="font-size:20px;"><strong>Email:</strong> ${email}</p>
            <p style="font-size:20px;"><strong>Phone:</strong> ${phone}</p>
            <h2 style="margin-top:30px;font-size:30px;color:#000;">Job Site:</h2>
            <p style="font-size:20px;">${address}, ${city}, ${state} ${zip}</p>
            <h2 style="margin-top:30px;font-size:30px;color:#000;">Service Details:</h2>
            <p style="font-size:20px;"><strong>Service Type:</strong> ${serviceType}</p>
            <p style="font-size:20px;"><strong>Preferred Date:</strong> ${preferredDate}</p>
            <p style="font-size:20px;"><strong>Message:</strong> ${message}</p>
            <h2 style="margin-top:40px;font-family:Arial,sans-serif;">Best Regards,</h2>
            <h2 style="font-family:Arial,sans-serif;">Bryson Davis: 706-263-0175</h2>
            <p style="font-family:Arial,sans-serif;">Traffic and Barrier Solutions, LLC | 721 N Wall St, Calhoun, GA 30701</p>
            <p><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
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

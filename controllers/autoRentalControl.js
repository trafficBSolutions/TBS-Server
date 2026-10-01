const RentalUser = require('../models/rentaluser');
const { transporter } = require('../utils/emailConfig');

const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions1999@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const salesEmail = 'Materialworx2@gmail.com';

const submitRental = async (req, res) => {
  try {
    const {
      first,
      last,
      company,
      email,
      phone,
      address,
      city,
      state,
      zip,
      equipment,
      startDate,
      endDate,
      message,
      orderType = 'rental'
    } = req.body;

    const isSale = orderType === 'sale';

    if (
      !first ||
      !last ||
      !company ||
      !email ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !zip ||
      !equipment
    ) {
      return res.status(400).json({
        error: 'Please fill in all required fields.'
      });
    }

    if (!isSale && (!startDate || !endDate)) {
      return res.status(400).json({
        error: 'Start date and end date are required for rentals.'
      });
    }

    if (!isSale && !message) {
      return res.status(400).json({
        error: 'Message is required for rentals.'
      });
    }

    const isValidEmail = /\S+@\S+\.\S+/.test(email);
    if (!isValidEmail) {
      return res.status(400).json({
        error: 'Invalid email address'
      });
    }

    const newUser = await RentalUser.create({
      first,
      last,
      company,
      email,
      phone,
      address,
      city,
      state,
      zip,
      equipment,
      startDate: isSale ? null : startDate,
      endDate: isSale ? null : endDate,
      message: isSale ? (message || '') : message,
      orderType
    });

    const bccList = isSale
      ? [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
          { name: 'Material WorX Sales', address: salesEmail },
          { name: 'Bryson Davis', address: mainEmail }
        ]
      : [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
          { name: 'Carson Speer', address: userEmail },
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail }
        ];

    const saleDetailsBlock = `
      <h2 style="font-size:32px; margin-top:30px;">Cone & Drum Pricing</h2>
      <p><strong>Drums</strong> - $46.00 includes Tire Ring</p>
      <p><strong>On orders 50+</strong></p>
      <p><strong>Cones (28&quot; 10lbs base)</strong></p>
      <ul>
        <li>1-100: $24.95 each (Pick up)</li>
        <li>101-299: $22.65 each (Pick up)</li>
        <li>299+: $20.45 each</li>
      </ul>
      <p><strong>Big Savings and Delivery 🚚 availability</strong></p>
      <p>Order from our website:
      <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
    `;

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: email,
      bcc: bccList,
      subject: isSale ? 'CONE / DRUM PURCHASE REQUEST' : 'EQUIPMENT RENTAL REQUEST',
      html: `
        <div style="font-family: Arial, sans-serif; background:#f4f4f4; padding:24px;">
          <div style="max-width:800px; margin:auto; background:#ffffff; padding:30px; border-radius:12px;">
            <h1 style="text-align:center;">TRAFFIC & BARRIER SOLUTIONS, LLC</h1>
            <h2 style="text-align:center;">
              ${isSale ? 'CONE / DRUM PURCHASE REQUEST' : 'EQUIPMENT RENTAL REQUEST'}
            </h2>

            <p>Dear ${first},</p>

            <p>
              ${
                isSale
                  ? 'Your cone / drum purchase request has been received successfully. We will review it and contact you soon.'
                  : 'Your equipment rental request has been received successfully. We will review it and contact you soon.'
              }
            </p>

            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${first} ${last}</p>
            <p><strong>Company:</strong> ${company}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Address:</strong> ${address}, ${city}, ${state} ${zip}</p>

            <h3>${isSale ? 'Requested Items' : 'Rental Equipment'}</h3>
            <p><strong>Equipment:</strong> ${equipment}</p>

            ${
              !isSale
                ? `
                  <p><strong>Start Date:</strong> ${startDate}</p>
                  <p><strong>End Date:</strong> ${endDate}</p>
                  <p><strong>Message:</strong> ${message}</p>
                `
                : `
                  <p><strong>Notes:</strong> ${message || 'No additional notes provided.'}</p>
                  ${saleDetailsBlock}
                `
            }

            <hr style="margin:30px 0;" />

            <p><strong>Contact:</strong> 706-263-0175</p>
            <p>
              <a href="http://www.trafficbarriersolutions.com">
                www.trafficbarriersolutions.com
              </a>
            </p>
          </div>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email notification:', error);
      } else {
        console.log('Email notification sent:', info.response);
      }
    });

    res.status(201).json({
      message: isSale ? 'Sale request submitted successfully' : 'Rental submitted successfully',
      newUser
    });
  } catch (error) {
    console.error('Error submitting rental/sale request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  submitRental
};

const PlanUser = require('../models/planuser');
const transporter4 = require('../utils/emailConfig'); // Use transporter2 only
const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';

const submitPlan = async (req, res) => {
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
            location,
            message
        } = req.body;

        const lat = req.body.lat;
        const lng = req.body.lng;
        const mapsUrl = `https://www.google.com/maps/search/?api=API_KEY&query=${lat},${lng}`;

        let structureFile, structureImg;

        if (req.files['structurefile']) {
            structureFile = req.files['structurefile'][0].filename;
        }

        if (req.files['structureimg']) {
            structureImg = req.files['structureimg'][0].filename;
        }

        const isValidEmail = /\S+@\S+\.\S+/.test(email);
        if (!isValidEmail) {
            return res.status(400).json({
                error: "Invalid email address"
            });
        }

        const newUser = await PlanUser.create({
            first,
            last,
            company,
            email,
            phone,
            address,
            city,
            state,
            zip,
            location,
            structurefile: structureFile,
            structureimg: structureImg,
            message
        });

        
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [
                { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
                { name: 'Bryson Davis', address: mainEmail },
                { name: 'Jonkell Tolbert', address: foreemail }
            ],
            subject: 'TRAFFIC CONTROL PLAN REQUEST',
              html: `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
        <h2 style="text-align: center; color: #000;">Traffic & Barrier Solutions, LLC</h2>
        <h3 style="text-align: center;">Traffic Control Plan Submission Confirmation</h3>

        <p>Hi ${first},</p>

        <p>Thank you for submitting your traffic control plan. We have received your request and will follow up within 48 hours.</p>

        <h4 style="margin-top: 30px;">Submission Details:</h4>
        <ul>
          <li><strong>Name:</strong> ${first} ${last}</li>
          <li><strong>Company:</strong> ${company}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Address:</strong> ${address}, ${city}, ${state} ${zip}</li>
          <li><strong>Message:</strong> ${message}</li>
        </ul>

        <p>If you have any questions, changes, or concerns, please call (706) 263-0175</a>.</p>

        <hr style="margin: 40px 0;">

        <h4>Contact Info:</h4>
        <p>
          Bryson Davis<br>
          Traffic & Barrier Solutions, LLC<br>
          1995 Dews Pond Rd SE<br>
          Calhoun, GA 30701<br>
          Phone: <a href="tel:7062630175">(706) 263-0175</a><br>
          Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a>
        </p>

        <p style="margin-top: 30px;">Thank you,<br>The TBS Admin Team</p>
      </body>
    </html>
  ``,
            attachments: []
        };

        if (structureFile) {
            mailOptions.attachments.push({
                filename: structureFile,
                path: `./files/${structureFile}`
            });
        }

        if (structureImg) {
            mailOptions.attachments.push({
                filename: structureImg,
                path: `./files/${structureImg}`
            });
        }
        

        transporter4.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email notification:', error);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });

        const response = {
            message: 'Plan submitted successfully',
            newUser: newUser // Include the newUser object in the response
        };
        
        res.status(201).json(response);
        
    } catch (error) {
        console.error('Error submitting plan:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    submitPlan
};

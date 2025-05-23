const PlanUser = require('../models/planuser');
const transporter4 = require('../utils/emailConfig'); // Use transporter2 only
const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const foremanmail = 'tbsolutions77@gmail.com';
const damienemail = 'tbsolutions14@gmail.com';
const submitPlan = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            company,
            project,
            address,
            city,
            state,
            zip,
            message,
            terms
        } = req.body;
        let structure;

        if (req.files['structure']) {
            structure = req.files['structure'][0].filename;
        }
        const isValidEmail = /\S+@\S+\.\S+/.test(email);
        if (!isValidEmail) {
            return res.status(400).json({
                error: "Invalid email address"
            });
        }

        const newUser = await PlanUser.create({
            name,
            company,
            email,
            phone,
            company,
            project,
            address,
            city,
            state,
            zip,
            structure: structure,
            message,
            terms
        });
        const attachments = [];
        if (structure) {
          attachments.push({ filename: structure, path: `./files/${structure}` });
        }
        
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [{ name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
                { name: 'Bryson Davis', address: mainEmail },
        { name: 'Jonkell Tolbert', address: foreemail },
        { name: 'Salvador Gonzalez', address: foremanmail},
        { name: 'Damien Diskey', address: damienemail}
               ],
            subject: 'TRAFFIC CONTROL PLAN REQUEST',
            html: `
            <html>
              <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
                <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
                  <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">TRAFFIC CONTROL PLAN REQUEST</h1>
                  
                  <p>Hi <strong>${name}</strong>,</p>
                  Your plan has been submitted! <br>
                  If you have any questions or concerns regarding your plan, please call (706) 263-0175.</p>
          
                  <h3>Summary:</h3>
                  <ul>
                    <li><strong>Coordinator:</strong> ${name}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Phone:</strong> ${phone}</li>
                    <li><strong>Company:</strong> ${company}</li>
                    <li><strong>Job/Project Number:</strong> ${project}</li>
                    <li><strong>Job Site Address:</strong> ${address}, ${city}, ${state} ${zip}</li>
                  </ul>
                  <h3>Additional Info:</h3>
                  <p>Terms & Conditions: ${terms}</p>
                  <p>${message}</p>
          
                  <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
                </div>
              </body>
            </html>
            `,
            attachments
          };

        if (structure) {
            mailOptions.attachments.push({
                filename: structure,
                path: `./files/${structure}`
            });
        }
        transporter4.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email notification:', error);
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

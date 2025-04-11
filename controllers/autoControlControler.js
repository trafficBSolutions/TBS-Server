const ControlUser = require('../models/controluser');
const transporter4 = require('../utils/emailConfig'); // Use transporter2 only
const myEmail = 'tbsolutions9@gmail.com';

const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';

const submitTrafficControlJob = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            jobDate,
            company,
            coordinator,
            time,
            project,
            flagger,
            equipment,
            address,
            city,
            state,
            zip,
            message
        } = req.body;

        // Parse the job date
        const submittedDate = new Date(jobDate);
        
        // Convert to EST timezone for consistent date comparison
        const estOptions = { timeZone: 'America/New_York' };
        const estDateStr = submittedDate.toLocaleDateString('en-US', estOptions);
        const [month, day, year] = estDateStr.split('/').map(Number);
        
        // Create EST midnight for the job date
        const estMidnight = new Date(Date.UTC(year, month - 1, day));
        
        // Count jobs for the same EST date
        const startOfDay = new Date(estMidnight);
        const endOfDay = new Date(estMidnight);
        endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
        
        const jobCount = await ControlUser.countDocuments({
            jobDate: { 
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        if (jobCount >= 10) {
            return res.status(400).json({ error: 'Job limit reached for the selected date' });
        }
        const jobDateFormatted = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(jobDate));
        // Create user record with the EST midnight date
        const newUser = await ControlUser.create({
            name,
            email,
            phone,
            jobDate: estMidnight, // Store consistent UTC date
            company,
            coordinator,
            time,
            project,
            flagger,
            equipment,
            address,
            city,
            state,
            zip,
            message
        });
        const cancelUrl = `https://www.trafficbarriersolutions.com/cancel-job/${newUser._id}`;

        // Compose email options
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
             bcc: [
                { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
                 
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
                { name: 'Bryson Davis', address: mainEmail },
                { name: 'Jonkell Tolbert', address: foreemail }
                
            ],
            subject: 'TRAFFIC CONTROL JOB REQUEST',
            html: `
            <html>
              <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
                <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
                  <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">TRAFFIC CONTROL JOB REQUEST</h1>
                  
                  <p>Hi <strong>${name}</strong>,</p>
                  <p>Your traffic control job has been submitted successfully. Your job will be scheduled on ${jobDateFormatted} at ${time}.
                  If you have any questions or concerns regarding your job, please call (706) 263-0175.</p>
          
                  <h3>Summary:</h3>
                  <ul>
                    <li><strong>Job Date:</strong> ${jobDateFormatted}</li>
                    <li><strong>Company:</strong> ${company}</li>
                    <li><strong>Coordinator:</strong> ${coordinator}</li>
                    <li><strong>Time:</strong> ${time}</li>
                    <li><strong>Project/Task:</strong> ${project}</li>
                    <li><strong>Flaggers:</strong> ${flagger}</li>
                    <li><strong>Equipment:</strong> ${equipment.join(', ')}</li>
                    <li><strong>Job Site Address:</strong> ${address}, ${city}, ${state} ${zip}</li>
                  </ul>
          
                  <h3>Additional Info:</h3>
                  <p>${message}</p>
          
                  <p>If you need to cancel this job, click here:</p>
                  <p><a href="${cancelUrl}" style="color: #d9534f;">Cancel Job</a></p>
          
                  <hr style="margin: 20px 0;">
                  <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
                </div>
              </body>
            </html>
            `
          };
          
        // Send email
        transporter4.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email notification:', error);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });

        const response = {
            message: 'Traffic Control Job submitted successfully',
            newUser: newUser // Include the newUser object in the response
        };

        res.status(201).json(response);

    } catch (error) {
        console.error('Error submitting plan:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    submitTrafficControlJob
};

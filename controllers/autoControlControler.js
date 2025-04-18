const ControlUser = require('../models/controluser');
const transporter = require('../utils/emailConfig'); // Use transporter2 only
const myEmail = 'tbsolutions9@gmail.com';

const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const foremanmail = 'tbsolutions77@gmail.com';
const damienemail = 'tbsolutions14@gmail.com';

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
        if (!Array.isArray(jobDate) || jobDate.length === 0) {
            return res.status(400).json({ error: 'No job dates provided' });
          }
          
          const failedDates = [];
          const scheduledDates = [];
          
          for (const dateStr of jobDate) {
            const submittedDate = new Date(dateStr);
          
            if (isNaN(submittedDate.getTime())) {
              failedDates.push(dateStr);
              continue;
            }
          
            const estOptions = { timeZone: 'America/New_York' };
            const estDateStr = submittedDate.toLocaleDateString('en-US', estOptions);
            const [month, day, year] = estDateStr.split('/').map(Number);
          
            const estMidnight = new Date(Date.UTC(year, month - 1, day));
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
              failedDates.push(estDateStr);
            } else {
              scheduledDates.push(estMidnight);
            }
          }
          if (scheduledDates.length === 0) {
            return res.status(400).json({ error: `All selected job dates are full. Try again later.` });
          }
          const jobDateFormatted = scheduledDates.map(d =>
            new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).format(d)
          );          
          const createdJobs = [];
          for (const dateObj of scheduledDates) {
            const newUser = await ControlUser.create({
                name,
                email,
                phone,
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
                message,
                jobDates: [
                  {
                    date: dateObj,
                    cancelled: false,
                    cancelledAt: null
                  }
                ]
              });
            createdJobs.push(newUser);
          }       
          const cancelLinks = createdJobs
          .map(job => {
            return job.jobDates.map(jobDateObj => {
              const dateString = new Date(jobDateObj.date).toLocaleDateString('en-US');
              return `<li><a href="https://www.trafficbarriersolutions.com/cancel-job/${job._id}">${dateString} – Cancel this job</a></li>`;
            }).join('');
          })
          .join('');
           
        // Compose email options
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
            subject: 'TRAFFIC CONTROL JOB REQUEST',
            html: `
            <html>
              <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
                <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
                  <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">TRAFFIC CONTROL JOB REQUEST</h1>
                  
                  <p>Hi <strong>${name}</strong>,</p>
                  Your job has been scheduled on the following date(s):<br>
                        <ul>
                            ${scheduledDates.map(d => `<li>${d.toLocaleDateString('en-US')}</li>`).join('')}
                    </ul>
                  If you have any questions or concerns regarding your job, please call (706) 263-0175.</p>
          
                  <h3>Summary:</h3>
                  <ul>
                    <li><strong>Company:</strong> ${company}</li>
                    <li><strong>Coordinator:</strong> ${coordinator}</li>
                    <li><strong>Phone:</strong> ${phone}</li>
                    <li><strong>Time:</strong> ${time}</li>
                    <li><strong>Project/Task:</strong> ${project}</li>
                    <li><strong>Flaggers:</strong> ${flagger}</li>
                    <li><strong>Equipment:</strong> ${equipment.join(', ')}</li>
                    <li><strong>Job Site Address:</strong> ${address}, ${city}, ${state} ${zip}</li>
                  </ul>
          
                  <h3>Additional Info:</h3>
                  <p>${message}</p>
          
                  <h3>If you need to cancel a date, use the link for that specific day:</h3>
                        <ul>${cancelLinks}</ul>
                  <hr style="margin: 20px 0;">
                  <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
                </div>
              </body>
            </html>
            `
          };
          
        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email notification:', error);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });

        const response = {
            message: 'Traffic Control Job submitted successfully',
            scheduledDates: scheduledDates.map(d => d.toISOString().split('T')[0]),
            createdJobs
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

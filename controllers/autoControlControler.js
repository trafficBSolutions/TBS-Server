const ControlUser = require('../models/controluser');
const { transporter } = require('../utils/emailConfig'); // uses EMAIL_USER
const { signQuery, verifyQuery } = require('../utils/linkToken');
const myEmail = 'tbsolutions9@gmail.com';
const path = require('path'); 

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
            siteContact,
            site,
            time,
            project,
            emergency,
            flagger,
            additionalFlaggers,
            additionalFlaggerCount,
            equipment,
            terms,
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
         
const pipeline = [
  { $match: { cancelled: { $ne: true } } },  // Exclude jobs that are entirely cancelled
  { $unwind: "$jobDates" },
  {
    $match: {
      "jobDates.date": { $gte: startOfDay, $lt: endOfDay },
      "jobDates.cancelled": { $ne: true }    // Exclude cancelled dates
    }
  },
  { $count: "count" }
];
const result = await ControlUser.aggregate(pipeline);
const jobCount = result[0]?.count || 0;

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
        // Check if additional flaggers need confirmation
        if (additionalFlaggers && additionalFlaggerCount > 0) {
          // Don't create jobs yet, just send confirmation email with form data
const confirmToken = signQuery({ 
  formData: req.body,
  scheduledDates: scheduledDates.map(d => d.toISOString()),
  additionalFlaggerCount,
  userEmail: email
});

// IMPORTANT: encode the token
const encoded = encodeURIComponent(confirmToken);

// IMPORTANT: hit an API route (server) first, then redirect back to the SPA page
const confirmLinkBase = 'https://tbs-server.onrender.com/confirm-additional-flagger';
const confirmYes = `${confirmLinkBase}?token=${encoded}&confirm=yes`;
const confirmNo  = `${confirmLinkBase}?token=${encoded}&confirm=no`;
          const confirmMailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [{ name: 'Traffic & Barrier Solutions, LLC', address: myEmail }],
            subject: 'CONFIRM ADDITIONAL FLAGGER - TRAFFIC CONTROL JOB',
            html: `
            <html>
              <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
                <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
                  <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">ADDITIONAL FLAGGER CONFIRMATION REQUIRED</h1>
                  <p>Hi <strong>${name}, ${email}</strong>,</p>
                  <p>You have requested <strong>${additionalFlaggerCount} additional flagger(s)</strong> for your traffic control job.</p>
                  <p><strong>IMPORTANT:</strong> Additional flaggers incur extra charges. Please confirm if you want to proceed.</p>
                  
                  <div style="display: flex; justify-content: center; gap: 15px; margin: 30px 0; flex-wrap: wrap;">
                    <a href="${confirmYes}&confirm=yes" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">YES - I CONFIRM</a>
                    <a href="${confirmNo}&confirm=no" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">NO - CANCEL</a>
                  </div>
                  
                  <p>Job Details:</p>
                  <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Company:</strong> ${company}</li>
                      <li><strong>Coordinator:</strong> ${coordinator}</li>
                      <li><strong>Coordinator Phone:</strong> ${phone}</li>
                      <li><strong>On-Site Contact:</strong> ${siteContact}</li>
                      <li><strong>On-Site Phone:</strong> ${site}</li>
                      <li><strong>Time:</strong> ${time}</li>
                    </ul>
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Project/Task:</strong> ${project}</li>
                      <li><strong>Flaggers:</strong> ${flagger}${additionalFlaggers ? ` + Additional: ${additionalFlaggerCount}` : ''}</li>
                      <li><strong>Equipment:</strong> ${equipment.join(', ')}</li>
                      <li><strong>Job Site Address:</strong> ${address}, ${city}, ${state} ${zip}</li>
                      <li><strong>Dates:</strong> ${scheduledDates.map(d => d.toLocaleDateString('en-US')).join(', ')}</li>
                    </ul>
                  </div>
                  
                  <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>Phone: (706) 263-0175</p>
                </div>
              </body>
            </html>
            `
          };
          
          transporter.sendMail(confirmMailOptions, (error, info) => {
            if (error) {
              console.error('Error sending confirmation email:', error);
              return res.status(500).json({ error: 'Failed to send confirmation email' });
            } else {
              console.log('Confirmation email sent:', info.response);
            }
          });
          
          return res.status(201).json({
            message: 'Please check your email to confirm additional flaggers before job submission.',
            requiresConfirmation: true,
            scheduledDates: scheduledDates.map(d => d.toISOString().split('T')[0])
          });
        }
        
        // Create jobs only if no additional flaggers
        const createdJobs = [];
        for (const dateObj of scheduledDates) {
          const newUser = await ControlUser.create({
              name,
              email,
              phone,
              company,
              coordinator,
              siteContact,
              site,
              time,
              project,
              emergency: emergency || false,
              flagger,
              additionalFlaggers: Boolean(additionalFlaggers),
              additionalFlaggerCount: Number(additionalFlaggerCount) || 0,
              equipment,
              terms,
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
        
        // Compose regular email options
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
                  <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Company:</strong> ${company}</li>
                      <li><strong>Coordinator:</strong> ${coordinator}</li>
                      <li><strong>Coordinator Phone:</strong> ${phone}</li>
                      <li><strong>On-Site Contact:</strong> ${siteContact}</li>
                      <li><strong>On-Site Phone:</strong> ${site}</li>
                    </ul>
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Time:</strong> ${time}</li>
                      <li><strong>Project/Task:</strong> ${project}</li>
                      <li><strong>Flaggers:</strong> ${flagger}${additionalFlaggers ? ` + Additional: ${additionalFlaggerCount}` : ''}</li>
                      <li><strong>Equipment:</strong> ${equipment.join(', ')}</li>
                      <li><strong>Job Site Address:</strong> ${address}, ${city}, ${state} ${zip}</li>
                    </ul>
                  </div>
                  <h3>Additional Info:</h3>
                  <p>Terms & Conditions: ${terms}</p>
                  <p>${message}</p>
                  <h3>If you need to cancel a date, use the link for that specific day:</h3>
                        <ul>${cancelLinks}</ul>
                    <p style="font-size: 14px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468 to note to the crew.
                  <hr style="margin: 20px 0;">
                  <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
                </div>
              </body>
            </html>
            `,
                  attachments: [
        {
          filename: 'TBSPDF7.png',
          path: path.join(__dirname, '..', 'public', 'TBSPDF7.png'),
          cid: 'tbslogo',
          contentDisposition: 'inline',
          contentType: 'image/png'
        }
      ]
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
const confirmAdditionalFlagger = async (req, res) => {
  try {
    const { token, confirm } = req.query;
    
    if (!token) {
      console.error('No token provided in confirmation request');
      return res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=error&message=' + encodeURIComponent('Invalid confirmation link'));
    }
    
    console.log('Attempting to verify token:', token.substring(0, 50) + '...');
    const payload = verifyQuery(token);
    if (!payload) {
      console.error('Token verification failed for token:', token.substring(0, 50) + '...');
      return res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=error&message=' + encodeURIComponent('Invalid or expired confirmation link'));
    }
    
    console.log('Token verified successfully, payload:', payload);
    
    const { formData, scheduledDates, additionalFlaggerCount, userEmail } = payload;
    const parsedDates = scheduledDates.map(d => new Date(d));
    
    // Validate required fields
    if (!formData.coordinator || formData.coordinator.trim() === '') {
      return res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=error&message=' + encodeURIComponent('Missing required coordinator information'));
    }
    
    // Re-check capacity for all dates (race condition protection)
    for (const dateObj of parsedDates) {
      const startOfDay = new Date(dateObj);
      const endOfDay = new Date(dateObj);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
      
      const pipeline = [
        { $match: { cancelled: { $ne: true } } },
        { $unwind: "$jobDates" },
        {
          $match: {
            "jobDates.date": { $gte: startOfDay, $lt: endOfDay },
            "jobDates.cancelled": { $ne: true }
          }
        },
        { $count: "count" }
      ];
      
      const result = await ControlUser.aggregate(pipeline);
      const jobCount = result[0]?.count || 0;
      
      if (jobCount >= 10) {
        return res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=error&message=' + encodeURIComponent(`Date ${dateObj.toLocaleDateString('en-US')} is now full. Please submit a new request.`));
      }
    }
    
    if (confirm === 'yes') {
      // User confirmed - create jobs with additional flaggers
      const createdJobs = [];
      for (const dateObj of parsedDates) {
        const newUser = await ControlUser.create({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          coordinator: formData.coordinator?.trim() || 'Unknown',
          siteContact: formData.siteContact || '',
          site: formData.site || '',
          time: formData.time,
          project: formData.project,
          emergency: formData.emergency || false,
          flagger: formData.flagger,
          additionalFlaggers: true,
          additionalFlaggerCount: Number(additionalFlaggerCount),
          equipment: formData.equipment,
          terms: formData.terms,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          message: formData.message,
          jobDates: [{
            date: dateObj,
            cancelled: false,
            cancelledAt: null
          }]
        });
        createdJobs.push(newUser);
      }
      
      const jobs = createdJobs;
      
      const cancelLinks = jobs
        .map(job => {
          return job.jobDates.map(jobDateObj => {
            const dateString = new Date(jobDateObj.date).toLocaleDateString('en-US');
            return `<li><a href="https://www.trafficbarriersolutions.com/cancel-job/${job._id}">${dateString} – Cancel this job</a></li>`;
          }).join('');
        })
        .join('');
      
      const finalMailOptions = {
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: userEmail,
        bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
          { name: 'Carson Speer', address: userEmail },
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: foremanmail },
          { name: 'Damien Diskey', address: damienemail }
        ],
        subject: 'TRAFFIC CONTROL JOB REQUEST - WITH ADDITIONAL FLAGGERS',
        html: `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76;; color: black; padding: 15px; border-radius: 6px;">${jobs[0]?.name} has scheduled a job with additional flaggers</h1>
              <p><strong>${jobs[0]?.name}, ${jobs[0]?.email} has selected YES to approve additional flaggers. </strong>,</p>
              <p>Hi <strong>${jobs[0]?.name}, </strong>,</p>
              <p>Your traffic control job has been confirmed with <strong>${additionalFlaggerCount} additional flagger(s)</strong>.</p>
              <p>Your job has been scheduled on the following date(s):</p>
              <ul>
                ${jobs.map(job => job.jobDates.map(d => `<li>${new Date(d.date).toLocaleDateString('en-US')}</li>`).join('')).join('')}
              </ul>
              
              <h3>Summary:</h3>
              <ul>
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Company:</strong> ${jobs[0]?.company}</li>
                      <li><strong>Coordinator:</strong> ${jobs[0]?.coordinator}</li>
                      <li><strong>Coordinator Phone:</strong> ${jobs[0]?.phone}</li>
                      <li><strong>On-Site Contact:</strong> ${jobs[0]?.siteContact}</li>
                      <li><strong>On-Site Phone:</strong> ${jobs[0]?.site}</li>
                      
                    </ul>
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Time:</strong> ${jobs[0]?.time}</li>
                      <li><strong>Project/Task:</strong> ${jobs[0]?.project}</li>
                      <li><strong>Flaggers:</strong> ${jobs[0]?.flagger} + Additional: ${additionalFlaggerCount}</li>
                      <li><strong>Equipment:</strong> ${jobs[0]?.equipment.join(', ')}</li>
                      <li><strong>Job Site Address:</strong> ${jobs[0]?.address}, ${jobs[0]?.city}, ${jobs[0]?.state} ${jobs[0]?.zip}</li>
                    </ul>
                  </div>
              </ul>
              <h3>Additional Info:</h3>
              <p>Terms & Conditions: ${jobs[0]?.terms}</p>
              <p>${jobs[0]?.message}</p>
              
              <h3>Cancel Links (if needed):</h3>
              <ul>${cancelLinks}</ul>
<p style="font-size: 14px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468 to note to the crew.
                  <hr style="margin: 20px 0;">
                  <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
            </div>
          </body>
        </html>
        `
      };
      
      try {
        await transporter.sendMail(finalMailOptions);
        console.log('Final confirmation email sent successfully');
      } catch (emailError) {
        console.error('Error sending final confirmation email:', emailError);
      }
      
      res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=success&message=' + encodeURIComponent('Additional flaggers confirmed. Final confirmation email sent.'));
      
    } else if (confirm === 'no') {
      // User declined - create jobs without additional flaggers
      const createdJobs = [];
      for (const dateObj of parsedDates) {
        const newUser = await ControlUser.create({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          coordinator: formData.coordinator?.trim() || 'Unknown',
          siteContact: formData.siteContact || '',
          site: formData.site || '',
          time: formData.time,
          project: formData.project,
          emergency: formData.emergency || false,
          flagger: formData.flagger,
          additionalFlaggers: false,
          additionalFlaggerCount: 0,
          equipment: formData.equipment,
          terms: formData.terms,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          message: formData.message,
          jobDates: [{
            date: dateObj,
            cancelled: false,
            cancelledAt: null
          }]
        });
        createdJobs.push(newUser);
      }
      
      const jobs = createdJobs;
      
      const cancelLinks = jobs
        .map(job => {
          return job.jobDates.map(jobDateObj => {
            const dateString = new Date(jobDateObj.date).toLocaleDateString('en-US');
            return `<li><a href="https://www.trafficbarriersolutions.com/cancel-job/${job._id}">${dateString} – Cancel this job</a></li>`;
          }).join('');
        })
        .join('');
      
      const originalMailOptions = {
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: userEmail,
        bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
          { name: 'Carson Speer', address: userEmail },
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: foremanmail },
          { name: 'Damien Diskey', address: damienemail }
        ],
        subject: 'TRAFFIC CONTROL JOB REQUEST - NO ADDITIONAL FLAGGERS',
        html: `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">TRAFFIC CONTROL JOB REQUEST</h1>
              <p><strong>${jobs[0]?.name}, ${jobs[0]?.email} has selected NO for additional flaggers. But job is still scheduled. </strong>,</p>
              <p>Hi <strong>${jobs[0]?.name}, </strong>,</p>
              <p>Your traffic control job has been confirmed without additional flaggers.</p>
              <p>Your job has been scheduled on the following date(s):</p>
              <ul>
                ${jobs.map(job => job.jobDates.map(d => `<li>${new Date(d.date).toLocaleDateString('en-US')}</li>`).join('')).join('')}
              </ul>
              
              <h3>Summary:</h3>
                            <ul>
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Company:</strong> ${jobs[0]?.company}</li>
                      <li><strong>Coordinator:</strong> ${jobs[0]?.coordinator}</li>
                      <li><strong>Coordinator Phone:</strong> ${jobs[0]?.phone}</li>
                      <li><strong>On-Site Contact:</strong> ${jobs[0]?.siteContact}</li>
                      <li><strong>On-Site Phone:</strong> ${jobs[0]?.site}</li>
                      
                    </ul>
                    <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                      <li><strong>Time:</strong> ${jobs[0]?.time}</li>
                      <li><strong>Project/Task:</strong> ${jobs[0]?.project}</li>
                      <li><strong>Flaggers:</strong> ${jobs[0]?.flagger}</li>
                      <li><strong>Equipment:</strong> ${jobs[0]?.equipment.join(', ')}</li>
                      <li><strong>Job Site Address:</strong> ${jobs[0]?.address}, ${jobs[0]?.city}, ${jobs[0]?.state} ${jobs[0]?.zip}</li>
                    </ul>
                  </div>
              </ul>
              <h3>Additional Info:</h3>
              <p>Terms & Conditions: ${jobs[0]?.terms}</p>
              <p>${jobs[0]?.message}</p>
              <h3>If you need to cancel a date, use the link for that specific day:</h3>
              <ul>${cancelLinks}</ul>
              <p style="font-size: 14px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468 to note to the crew.
              <hr style="margin: 20px 0;">
              <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
            </div>
          </body>
        </html>
        `
      };
      
      try {
        await transporter.sendMail(originalMailOptions);
        console.log('Original confirmation email sent successfully');
      } catch (emailError) {
        console.error('Error sending original confirmation email:', emailError);
      }
      
      res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=success&message=' + encodeURIComponent('Additional flaggers cancelled. Original job confirmed.'));
    }
    
  } catch (error) {
    console.error('Error in confirmation:', error);
    res.redirect('https://www.trafficbarriersolutions.com/confirm-additional-flagger?status=error&message=' + encodeURIComponent('An error occurred processing your confirmation'));
  }
};

module.exports = {
  submitTrafficControlJob,
  confirmAdditionalFlagger
};

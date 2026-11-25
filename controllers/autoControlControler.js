const ControlUser = require('../models/controluser');
const { transporter } = require('../utils/emailConfig'); // uses EMAIL_USER
const { signQuery, verifyQuery } = require('../utils/linkToken');
const { getRegionFromCity } = require('../utils/gaRegions');
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
            siteContact,
            siteContactEmail,
            site,
            time,
            project,
            emergency,
            flagger,
            additionalFlaggers,
            additionalFlaggerCount,
            policeOfficerNeeded,
            equipment,
            terms,
            address,
            city,
            state,
            zip,
            message
        } = req.body;

        // Determine region via geocoding (distance from Tifton, GA)
        const region = await getRegionFromCity(city, state);

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
         
const regionMatch = region === 'south' 
  ? { region: 'south' } 
  : { $or: [{ region: 'north' }, { region: { $exists: false } }] };
const pipeline = [
  { $match: { cancelled: { $ne: true }, ...regionMatch } },
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
        /* COMMENTED OUT - Email confirmation disabled to prevent duplicate jobs
        if (additionalFlaggers && additionalFlaggerCount > 0) {
          // Don't create jobs yet, just send confirmation email with form data
          const confirmToken = signQuery({ 
            formData: req.body,
            scheduledDates: scheduledDates.map(d => d.toISOString()),
            additionalFlaggerCount,
            userEmail: email
          });

          const encoded = encodeURIComponent(confirmToken);
          const confirmLinkBase = 'https://tbs-server.onrender.com/confirm-additional-flagger';
          const confirmYes = `${confirmLinkBase}?token=${encoded}&confirm=yes`;
          const confirmNo  = `${confirmLinkBase}?token=${encoded}&confirm=no`;
          
          const confirmMailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [{ name: 'Traffic & Barrier Solutions, LLC', address: myEmail }],
            subject: 'CONFIRM ADDITIONAL FLAGGER - TRAFFIC CONTROL JOB',
            html: `...`
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
        */
        
        // Create ONE job with multiple dates
        const newUser = await ControlUser.create({
            name,
            email,
            phone,
            company,
            coordinator: name,
            siteContact,
            siteContactEmail,
            site,
            time,
            project,
            emergency: emergency || false,
            flagger,
            additionalFlaggers: Boolean(additionalFlaggers),
            additionalFlaggerCount: Number(additionalFlaggerCount) || 0,
            policeOfficerNeeded: Boolean(policeOfficerNeeded),
            equipment,
            terms,
            address,
            city,
            region,
            state,
            zip,
            message,
            jobDates: scheduledDates.map(dateObj => ({
              date: dateObj,
              cancelled: false,
              cancelledAt: null
            }))
          });
        
        const cancelLinks = newUser.jobDates.map(jobDateObj => {
          const dateString = new Date(jobDateObj.date).toLocaleDateString('en-US');
          const isoStr = new Date(jobDateObj.date).toISOString().split('T')[0];
          return `<li>${dateString} – <a href="https://www.trafficbarriersolutions.com/reschedule-job/${newUser._id}?date=${isoStr}">Reschedule</a> | <a href="https://www.trafficbarriersolutions.com/cancel-job/${newUser._id}?date=${isoStr}">Cancel</a></li>`;
        }).join('');
        
        // Compose email with additional flagger notification if applicable
        const emailSubject = additionalFlaggers && additionalFlaggerCount > 0
          ? `TRAFFIC CONTROL JOB REQUEST - ${name} has scheduled a job with additional flaggers`
          : 'TRAFFIC CONTROL JOB REQUEST';
        
        const additionalFlaggerNote = additionalFlaggers && additionalFlaggerCount > 0
          ? `<p style="background-color: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0;"><strong>⚠️ Note:</strong> ${name} has approved <strong>${additionalFlaggerCount} additional flagger(s)</strong> for this job. Additional charges apply.</p>`
          : '';
        
        const policeOfficerNote = policeOfficerNeeded
          ? `<p style="background-color: #e3f2fd; padding: 10px; border-left: 4px solid #2196F3; margin: 15px 0;"><strong>🚔 Police Officer Needed:</strong> This job requires a police officer on site.</p>`
          : '';
        
        const extraTo = [siteContactEmail].filter(Boolean);
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: [email, ...extraTo].join(','),
            bcc: [{ name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
                  
              { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
              { name: 'Bryson Davis', address: mainEmail },
      { name: 'Jonkell Tolbert', address: foreemail },
      { name: 'Salvador Gonzalez', address: foremanmail},
      { name: 'Damien Diskey', address: damienemail}
      
             ],
            subject: emailSubject,
            html: `
<html>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
  <div style="max-width:640px;margin:auto;background:#fff;padding:24px;border-radius:8px;">
    <div style="background:#efad76;border-radius:6px;margin:0 0 20px;padding:14px 20px;display:table;width:100%;box-sizing:border-box;">
      <div style="display:table-cell;vertical-align:middle;width:130px;">
        <img src="https://tbs-server.onrender.com/public/TBS%20New%20logo.svg" alt="TBS" width="120" style="display:block;" />
      </div>
      <div style="display:table-cell;vertical-align:middle;text-align:right;">
        <div style="color:#000;font-size:18px;font-weight:800;">TRAFFIC CONTROL JOB REQUEST</div>
        <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">${name}</div>
      </div>
    </div>
    ${additionalFlaggerNote}
    ${policeOfficerNote}
    <div style="background:#f9f9f9;padding:14px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:4px 0;">Hi <strong>${name}</strong>, your job has been scheduled on the following date(s):</p>
      <ul style="margin:8px 0;">${newUser.jobDates.map(d => `<li>${new Date(d.date).toLocaleDateString('en-US')}</li>`).join('')}</ul>
      <p style="margin:4px 0;">If you have any questions or concerns, please call <strong>(706) 263-0175</strong>.</p>
    </div>
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Job Summary</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;width:50%;">Company</td><td style="padding:6px 10px;border:1px solid #ddd;">${company}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator</td><td style="padding:6px 10px;border:1px solid #ddd;">${name}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator Email</td><td style="padding:6px 10px;border:1px solid #ddd;">${email}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator Phone</td><td style="padding:6px 10px;border:1px solid #ddd;">${phone}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Contact</td><td style="padding:6px 10px;border:1px solid #ddd;">${siteContact}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Contact Email</td><td style="padding:6px 10px;border:1px solid #ddd;">${siteContactEmail || 'N/A'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Phone</td><td style="padding:6px 10px;border:1px solid #ddd;">${site}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:6px 10px;border:1px solid #ddd;">${time}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Project/Task</td><td style="padding:6px 10px;border:1px solid #ddd;">${project}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Flaggers</td><td style="padding:6px 10px;border:1px solid #ddd;">${flagger}${additionalFlaggers ? ` + Additional: ${additionalFlaggerCount}` : ''}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Police Officer Needed</td><td style="padding:6px 10px;border:1px solid #ddd;">${policeOfficerNeeded ? 'Yes' : 'No'}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Equipment</td><td style="padding:6px 10px;border:1px solid #ddd;">${equipment.join(', ')}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Job Site Address</td><td style="padding:6px 10px;border:1px solid #ddd;">${address}, ${city}, ${state} ${zip}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Terms & Conditions</td><td style="padding:6px 10px;border:1px solid #ddd;">${terms}</td></tr>
      ${message ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Message</td><td style="padding:6px 10px;border:1px solid #ddd;">${message}</td></tr>` : ''}
    </table>
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Manage Your Job Dates</h3>
    <p style="margin:0 0 8px;">You can reschedule or cancel individual dates using the links below:</p>
    <ul style="margin:0 0 20px;">${cancelLinks}</ul>
    <div style="text-align:center;border-top:2px solid #17365D;padding-top:16px;margin-top:24px;">
      <p style="margin:4px 0;font-size:13px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468.</p>
      <p style="margin:4px 0;font-weight:bold;">Traffic &amp; Barrier Solutions, LLC</p>
      <p style="margin:4px 0;">1995 Dews Pond Rd SE, Calhoun, GA 30701 &nbsp;|&nbsp; (706) 263-0175</p>
      <p style="margin:4px 0;"><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
    </div>
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
            createdJob: newUser
        };
        res.status(201).json(response);

    } catch (error) {
        console.error('Error submitting plan:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
const confirmAdditionalFlagger = async (req, res) => {
  try {
    console.log('Confirmation request received:', req.query);
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
      // User confirmed - create ONE job with multiple dates
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
        jobDates: parsedDates.map(dateObj => ({
          date: dateObj,
          cancelled: false,
          cancelledAt: null
        }))
      });
      
      const cancelLinks = newUser.jobDates.map(jobDateObj => {
        const dateString = new Date(jobDateObj.date).toLocaleDateString('en-US');
        const isoStr = new Date(jobDateObj.date).toISOString().split('T')[0];
        return `<li>${dateString} – <a href="https://www.trafficbarriersolutions.com/reschedule-job/${newUser._id}?date=${isoStr}">Reschedule</a> | <a href="https://www.trafficbarriersolutions.com/cancel-job/${newUser._id}?date=${isoStr}">Cancel</a></li>`;
      }).join('');
      
      const finalMailOptions = {
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: userEmail,
        bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: foremanmail },
          { name: 'Damien Diskey', address: damienemail }
        ],
        subject: 'TRAFFIC CONTROL JOB REQUEST - WITH ADDITIONAL FLAGGERS',
        html: `
<html>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
  <div style="max-width:640px;margin:auto;background:#fff;padding:24px;border-radius:8px;">
    <div style="background:#17365D;border-radius:6px;margin:0 0 20px;padding:14px 20px;display:table;width:100%;box-sizing:border-box;">
      <div style="display:table-cell;vertical-align:middle;width:130px;">
        <img src="https://tbs-server.onrender.com/public/TBS%20New%20logo%20White.svg" alt="TBS" width="120" style="display:block;" />
      </div>
      <div style="display:table-cell;vertical-align:middle;text-align:right;">
        <div style="color:#fff;font-size:18px;font-weight:800;">JOB CONFIRMED — WITH ADDITIONAL FLAGGERS</div>
        <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">${newUser.name}</div>
      </div>
    </div>
    <div style="background:#f9f9f9;padding:14px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:4px 0;"><strong>${newUser.name}</strong> (${newUser.email}) has selected <strong>YES</strong> to approve additional flaggers.</p>
      <p style="margin:4px 0;">Hi <strong>${newUser.name}</strong>, your traffic control job has been confirmed with <strong>${additionalFlaggerCount} additional flagger(s)</strong>.</p>
      <p style="margin:4px 0;">Scheduled date(s):</p>
      <ul style="margin:8px 0;">${newUser.jobDates.map(d => `<li>${new Date(d.date).toLocaleDateString('en-US')}</li>`).join('')}</ul>
    </div>
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Job Summary</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;width:50%;">Company</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.company}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.coordinator}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator Phone</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.phone}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Contact</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.siteContact}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Phone</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.site}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.time}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Project/Task</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.project}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Flaggers</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.flagger} + Additional: ${additionalFlaggerCount}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Equipment</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.equipment.join(', ')}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Job Site Address</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.address}, ${newUser.city}, ${newUser.state} ${newUser.zip}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Terms & Conditions</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.terms}</td></tr>
      ${newUser.message ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Message</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.message}</td></tr>` : ''}
    </table>
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Manage Your Job Dates</h3>
    <p style="margin:0 0 8px;">You can reschedule or cancel individual dates:</p>
    <ul style="margin:0 0 20px;">${cancelLinks}</ul>
    <div style="text-align:center;border-top:2px solid #17365D;padding-top:16px;margin-top:24px;">
      <p style="margin:4px 0;font-size:13px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468.</p>
      <p style="margin:4px 0;font-weight:bold;">Traffic &amp; Barrier Solutions, LLC</p>
      <p style="margin:4px 0;">1995 Dews Pond Rd SE, Calhoun, GA 30701 &nbsp;|&nbsp; (706) 263-0175</p>
      <p style="margin:4px 0;"><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
    </div>
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
      // User declined - create ONE job without additional flaggers
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
        jobDates: parsedDates.map(dateObj => ({
          date: dateObj,
          cancelled: false,
          cancelledAt: null
        }))
      });
      
      const cancelLinks = newUser.jobDates.map(jobDateObj => {
        const dateString = new Date(jobDateObj.date).toLocaleDateString('en-US');
        const isoStr = new Date(jobDateObj.date).toISOString().split('T')[0];
        return `<li>${dateString} – <a href="https://www.trafficbarriersolutions.com/reschedule-job/${newUser._id}?date=${isoStr}">Reschedule</a> | <a href="https://www.trafficbarriersolutions.com/cancel-job/${newUser._id}?date=${isoStr}">Cancel</a></li>`;
      }).join('');
      
      const originalMailOptions = {
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: userEmail,
        bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: foremanmail },
          { name: 'Damien Diskey', address: damienemail }
        ],
        subject: 'TRAFFIC CONTROL JOB REQUEST - NO ADDITIONAL FLAGGERS',
        html: `
<html>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
  <div style="max-width:640px;margin:auto;background:#fff;padding:24px;border-radius:8px;">
    <div style="background:#17365D;border-radius:6px;margin:0 0 20px;padding:14px 20px;display:table;width:100%;box-sizing:border-box;">
      <div style="display:table-cell;vertical-align:middle;width:130px;">
        <img src="https://tbs-server.onrender.com/public/TBS%20New%20logo%20White.svg" alt="TBS" width="120" style="display:block;" />
      </div>
      <div style="display:table-cell;vertical-align:middle;text-align:right;">
        <div style="color:#fff;font-size:18px;font-weight:800;">TRAFFIC CONTROL JOB REQUEST</div>
        <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">${newUser.name}</div>
      </div>
    </div>
    <div style="background:#f9f9f9;padding:14px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:4px 0;"><strong>${newUser.name}</strong> (${newUser.email}) has selected <strong>NO</strong> for additional flaggers. Job is still scheduled.</p>
      <p style="margin:4px 0;">Hi <strong>${newUser.name}</strong>, your traffic control job has been confirmed without additional flaggers.</p>
      <p style="margin:4px 0;">Scheduled date(s):</p>
      <ul style="margin:8px 0;">${newUser.jobDates.map(d => `<li>${new Date(d.date).toLocaleDateString('en-US')}</li>`).join('')}</ul>
    </div>
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Job Summary</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;width:50%;">Company</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.company}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.coordinator}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Coordinator Phone</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.phone}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Contact</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.siteContact}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">On-Site Phone</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.site}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.time}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Project/Task</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.project}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Flaggers</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.flagger}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Equipment</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.equipment.join(', ')}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Job Site Address</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.address}, ${newUser.city}, ${newUser.state} ${newUser.zip}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Terms & Conditions</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.terms}</td></tr>
      ${newUser.message ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Message</td><td style="padding:6px 10px;border:1px solid #ddd;">${newUser.message}</td></tr>` : ''}
    </table>
    <h3 style="background:#17365D;color:#fff;padding:8px 12px;border-radius:4px;margin:0 0 10px;">Manage Your Job Dates</h3>
    <p style="margin:0 0 8px;">You can reschedule or cancel individual dates:</p>
    <ul style="margin:0 0 20px;">${cancelLinks}</ul>
    <div style="text-align:center;border-top:2px solid #17365D;padding-top:16px;margin-top:24px;">
      <p style="margin:4px 0;font-size:13px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468.</p>
      <p style="margin:4px 0;font-weight:bold;">Traffic &amp; Barrier Solutions, LLC</p>
      <p style="margin:4px 0;">1995 Dews Pond Rd SE, Calhoun, GA 30701 &nbsp;|&nbsp; (706) 263-0175</p>
      <p style="margin:4px 0;"><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
    </div>
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

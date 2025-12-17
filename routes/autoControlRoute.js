const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const { submitTrafficControlJob, confirmAdditionalFlagger } = require('../controllers/autoControlControler');
const { transporter } = require('../utils/emailConfig'); // uses EMAIL_USER
const myEmail = 'tbsolutions9@gmail.com';
const ControlUser = require('../models/controluser'); // Import your model

const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const formanmail = 'tbsolutions77@gmail.com';
const damienemail = 'tbsolutions14@gmail.com';

// Middleware
router.use(
    cors({
        credentials: true,
        /* origin: 'http://localhost:5173' // Make sure this matches your frontend*/
        origin: ['https://www.trafficbarriersolutions.com']
    })
);

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// 🚦 Job Submission
router.post('/trafficcontrol', submitTrafficControlJob);

// Additional Flagger Confirmation
router.get('/confirm-additional-flagger', confirmAdditionalFlagger);
// PATCH /manage-job/:id – update jobDates only
// ✅ Get a specific job by ID
// Add this route to fetch a specific job by ID
router.get('/trafficcontrol/:id', async (req, res) => {
  try {
    const job = await ControlUser.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add this route to update a job
router.patch('/manage-job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { updatedJob } = req.body;

    if (!updatedJob || typeof updatedJob !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing job data' });
    }

    const job = await ControlUser.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // ✅ Safely update job fields
    Object.keys(updatedJob).forEach(key => {
      if (key !== '_id') {
        job[key] = updatedJob[key];
      }
    });
job.updatedAt = new Date();
await job.save();


    // Email logic here (optional)
// Format updated job dates
const formattedDates = job.jobDates.map(d =>
  new Date(d.date).toLocaleDateString('en-US')
).join(', ');

/*
// Dynamic links for update & cancel
const cancelLink = `http://localhost:5173/cancel-job/${job._id}`;
const updateLink = `http://localhost:5173/manage-job/${job._id}`;
*/
const cancelLink = `https://www.trafficbarriersolutions.com/cancel-job/${job._id}`;
const updateLink = `https://www.trafficbarriersolutions.com/manage-job/${job._id}`;

const mailOptions = {
  from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
  to: job.email,
  bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
           
          { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: formanmail},
          { name: 'Damien Diskey', address: damienemail}
           
      ],
  subject: 'TRAFFIC CONTROL JOB UPDATED',
html: `
  <h2>Updated Traffic Control Job</h2>
  <p>Dear ${job.name},</p>
  <p>Your job has been successfully updated. Here is the current job info:</p>

  <h3>Updated Date(s):</h3>
  <ul>
    ${job.jobDates.map(jobDateObj => {
      const dateStr = new Date(jobDateObj.date).toLocaleDateString('en-US');
      const isoStr = new Date(jobDateObj.date).toISOString().split('T')[0];
      const cancelDateLink = `https://www.trafficbarriersolutions.com/cancel-job/${job._id}?date=${isoStr}`;
      return `<li>${dateStr} – <a href="${cancelDateLink}">Cancel this date</a></li>`;
    }).join('')}
  </ul>

  <p><strong>Company:</strong> ${job.company}</p>
  <p><strong>Coordinator:</strong> ${job.coordinator}</p>
  <p><strong>Phone:</strong> ${job.phone}</p>
  <p><strong>Project/Task:</strong> ${job.project}</p>
  <p><strong>Job Site:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>

  <h3>Need to update again or cancel the whole job?</h3>
  <ul>
    <li><a href="${updateLink}">Update Entire Job</a></li>
    <li><a href="${cancelLink}">Cancel Entire Job</a></li>
  </ul>

  <p>If anything looks incorrect, please call (706) 263-0175 immediately.</p>
  <p>— TBS Admin Team</p>
`
};

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error('Error sending update email:', err);
  } else {
    console.log('Update email sent:', info.response);
  }
});

    res.status(200).json({ message: 'Job updated successfully', job });
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔄 Reschedule a job date
router.patch('/reschedule-job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { oldDate, newDate } = req.body;

    if (!oldDate || !newDate) {
      return res.status(400).json({ error: 'Both old and new dates are required' });
    }

    const job = await ControlUser.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Parse dates
    const oldDateObj = new Date(oldDate);
    const newDateObj = new Date(newDate);

    // Find the old date in jobDates array
    const dateIndex = job.jobDates.findIndex(d =>
      new Date(d.date).toDateString() === oldDateObj.toDateString()
    );

    if (dateIndex === -1) {
      return res.status(404).json({ error: 'Original job date not found' });
    }

    // Check if the new date is already full
    const [year, month, day] = [newDateObj.getFullYear(), newDateObj.getMonth(), newDateObj.getDate()];
    const estMidnight = new Date(Date.UTC(year, month, day));
    const startOfDay = new Date(estMidnight);
    const endOfDay = new Date(estMidnight);
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
      return res.status(400).json({ error: 'The new date is already fully booked. Please choose another date.' });
    }

    // Update the date
    job.jobDates[dateIndex].date = estMidnight;
    job.jobDates[dateIndex].rescheduled = true;
    job.jobDates[dateIndex].rescheduledAt = new Date();
    job.jobDates[dateIndex].originalDate = oldDateObj;

    await job.save();

    const oldFormatted = oldDateObj.toLocaleDateString('en-US');
    const newFormatted = newDateObj.toLocaleDateString('en-US');

    // Send reschedule confirmation email
    const rescheduleEmail = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: job.email,
      bcc: [
        { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
        { name: 'Carson Speer', address: userEmail },
        { name: 'Bryson Davis', address: mainEmail },
        { name: 'Jonkell Tolbert', address: foreemail },
        { name: 'Salvador Gonzalez', address: formanmail },
        { name: 'Damien Diskey', address: damienemail }
      ],
      subject: job.additionalFlaggers ? 'TRAFFIC CONTROL JOB WITH ADDITIONAL FLAGGERS RESCHEDULED' : 'TRAFFIC CONTROL JOB RESCHEDULED',
      html: `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px;">TRAFFIC CONTROL JOB RESCHEDULED</h1>
              
              <p>Hi <strong>${job.name}</strong>,</p>
              <p>Your traffic control job${job.additionalFlaggers ? ' with additional flaggers' : ''} has been successfully rescheduled:</p>
              <ul>
                <li><strong>Original Date:</strong> ${oldFormatted}</li>
                <li><strong>New Date:</strong> ${newFormatted}</li>
              </ul>

              <h3>Summary:</h3>
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                  <li><strong>Company:</strong> ${job.company}</li>
                  <li><strong>Coordinator:</strong> ${job.coordinator}</li>
                  <li><strong>Coordinator Phone:</strong> ${job.phone}</li>
                  <li><strong>On-Site Contact:</strong> ${job.siteContact}</li>
                  <li><strong>On-Site Phone:</strong> ${job.site}</li>
                </ul>
                <ul style="flex: 1; min-width: 250px; margin: 0; padding-left: 20px;">
                  <li><strong>Time:</strong> ${job.time}</li>
                  <li><strong>Project/Task:</strong> ${job.project}</li>
                  <li><strong>Flaggers:</strong> ${job.flagger}${job.additionalFlaggers ? ` + Additional: ${job.additionalFlaggerCount}` : ''}</li>
                  <li><strong>Equipment:</strong> ${job.equipment.join(', ')}</li>
                  <li><strong>Job Site Address:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</li>
                </ul>
              </div>
              ${job.additionalFlaggers ? '<p><strong>Note:</strong> The additional flagger charges still apply to this rescheduled date.</p>' : ''}

              <h3>Manage Your Job Dates:</h3>
              <p>You can reschedule or cancel individual dates using the links below:</p>
              <ul>
                ${job.jobDates.map(jobDateObj => {
                  const dateStr = new Date(jobDateObj.date).toLocaleDateString('en-US');
                  const isoStr = new Date(jobDateObj.date).toISOString().split('T')[0];
                  const rescheduleLink = `https://www.trafficbarriersolutions.com/reschedule-job/${job._id}?date=${isoStr}`;
                  const cancelDateLink = `https://www.trafficbarriersolutions.com/cancel-job/${job._id}?date=${isoStr}`;
                  return `<li>${dateStr} – <a href="${rescheduleLink}">Reschedule</a> | <a href="${cancelDateLink}">Cancel</a></li>`;
                }).join('')}
              </ul>
              <p style="font-size: 14px;">If you have any concerns for how your job needs to be set up, please call Carson Speer (706) 581-4465 or Salvador Gonzalez (706) 659-5468 to note to the crew.</p>
              <hr style="margin: 20px 0;">
              <p style="font-size: 14px;">Traffic & Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
            </div>
          </body>
        </html>
      `
    };

    transporter.sendMail(rescheduleEmail, (err, info) => {
      if (err) {
        console.error('Error sending reschedule email:', err);
      } else {
        console.log('Reschedule email sent:', info.response);
      }
    });

    res.status(200).json({ 
      message: `Job rescheduled from ${oldFormatted} to ${newFormatted}`,
      job 
    });

  } catch (err) {
    console.error('Error rescheduling job:', err);
    res.status(500).json({ error: 'Failed to reschedule job' });
  }
});

// 🗑️ Cancel a job by ID
router.delete('/cancel-job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const job = await ControlUser.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // If no ?date provided, cancel the whole job (existing logic)
if (!date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Only cancel future dates, not past/completed ones
  let cancelledAnyDate = false;
  job.jobDates.forEach(jobDate => {
    const jobDateOnly = new Date(jobDate.date.getFullYear(), jobDate.date.getMonth(), jobDate.date.getDate());
    if (jobDateOnly >= today && !jobDate.cancelled) {
      jobDate.cancelled = true;
      jobDate.cancelledAt = new Date();
      cancelledAnyDate = true;
    }
  });
  
  if (!cancelledAnyDate) {
    return res.status(400).json({ error: 'No future dates available to cancel. Past or completed jobs cannot be cancelled.' });
  }
  
  // Check if all dates are now cancelled
  const allCancelled = job.jobDates.every(d => d.cancelled);
  job.cancelled = allCancelled;
  job.cancelledAt = allCancelled ? new Date() : null;
  
  await job.save();

  const cancelledDates = job.jobDates
    .filter(d => d.cancelled && d.cancelledAt && d.cancelledAt.toDateString() === new Date().toDateString())
    .map(d => new Date(d.date).toLocaleDateString('en-US'));
  
  const formattedDates = cancelledDates.join(', ');

  const fullCancelEmail = {
    from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
    to: job.email,
    bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
           
          { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: formanmail},
          { name: 'Damien Diskey', address: damienemail}
        
      ],
    subject: job.additionalFlaggers ? 'TRAFFIC CONTROL JOB WITH ADDITIONAL FLAGGERS CANCELLED' : 'TRAFFIC CONTROL JOB CANCELLED',
    html: `
      <h2>Traffic Control Job Cancelled${job.additionalFlaggers ? ' - With Additional Flaggers' : ''}</h2>
      <p>Dear ${job.name},</p>
      <p>Your traffic control job${job.additionalFlaggers ? ' with additional flaggers' : ''} scheduled for the following future date(s) has been cancelled:</p>
      <ul>${cancelledDates.map(d => `<li>${d}</li>`).join('')}</ul>
      ${job.jobDates.some(d => !d.cancelled) ? '<p><strong>Note:</strong> Past or completed job dates were not affected by this cancellation.</p>' : ''}
      <p><strong>Project/Task Number:</strong> ${job.project}</p>
      <p><strong>Coordinator:</strong> ${job.coordinator}</p>
      <p><strong>Company:</strong> ${job.company}</p>
      <p><strong>Flaggers:</strong> ${job.flagger}${job.additionalFlaggers ? ` + Additional: ${job.additionalFlaggerCount}` : ''}</p>
      <p><strong>Location:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>
      ${job.additionalFlaggers ? '<p><strong>Note:</strong> The additional flagger charges have been cancelled along with this job.</p>' : ''}
      <p>— TBS Admin Team</p>
    `
  };

  transporter.sendMail(fullCancelEmail, (err, info) => {
    if (err) {
      console.error('Error sending full cancellation email:', err);
    } else {
      console.log('Full cancellation email sent:', info.response);
    }
  });

  return res.status(200).json({ message: 'Entire job cancelled' });
}


// ✅ Parse ISO string date
const targetDate = new Date(date);
const dateIndex = job.jobDates.findIndex(d =>
  new Date(d.date).toDateString() === targetDate.toDateString()
);

if (dateIndex === -1) {
  return res.status(404).json({ error: 'Job date not found in record' });
}

// Check if the date is in the past
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const jobDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

if (jobDateOnly < today) {
  return res.status(400).json({ error: 'Cannot cancel past or completed job dates.' });
}

if (job.jobDates[dateIndex].cancelled) {
  return res.status(400).json({ error: 'This job date is already cancelled.' });
}

// Cancel just the one date
job.jobDates[dateIndex].cancelled = true;
job.jobDates[dateIndex].cancelledAt = new Date();

// Check if all dates are now cancelled
const allCancelled = job.jobDates.every(d => d.cancelled);
job.cancelled = allCancelled;
job.cancelledAt = allCancelled ? new Date() : null;

await job.save();

// Use the correct date object from the array
const formatted = new Date(job.jobDates[dateIndex].date).toLocaleDateString('en-US');
    // ✉️ Email notification for single-date cancel
    const cancelDateMail = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: job.email,
      bcc: [
          { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
           
          { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
          { name: 'Bryson Davis', address: mainEmail },
          { name: 'Jonkell Tolbert', address: foreemail },
          { name: 'Salvador Gonzalez', address: formanmail},
          { name: 'Damien Diskey', address: damienemail}
           
      ],
      subject: job.additionalFlaggers ? 'TRAFFIC CONTROL DATE WITH ADDITIONAL FLAGGERS CANCELLED' : 'TRAFFIC CONTROL DATE CANCELLED',
      html: `
        <h2>Job Date Cancelled${job.additionalFlaggers ? ' - With Additional Flaggers' : ''}</h2>
        <p>Dear ${job.name},</p>
        <p>The following job date${job.additionalFlaggers ? ' with additional flaggers' : ''} has been cancelled:</p>
        <ul><li><strong>${formatted}</strong></li></ul>

        <p><strong>Project/Task Number:</strong> ${job.project}</p>
        <p><strong>Company:</strong> ${job.company}</p>
        <p><strong>Coordinator:</strong> ${job.coordinator}</p>
        <p><strong>Flaggers:</strong> ${job.flagger}${job.additionalFlaggers ? ` + Additional: ${job.additionalFlaggerCount}` : ''}</p>
        <p><strong>Location:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>
        ${job.additionalFlaggers ? '<p><strong>Note:</strong> The additional flagger charges for this date have been cancelled.</p>' : ''}

        <p>If this was a mistake, please <a href="https://www.trafficbarriersolutions.com/manage-job/${job._id}">update your job again</a> or call (706) 263-0175.</p>
        <p>— TBS Admin Team</p>
      `
    };

    transporter.sendMail(cancelDateMail, (err, info) => {
      if (err) {
        console.error('Error sending partial cancel email:', err);
      } else {
        console.log('Single date cancel email sent:', info.response);
      }
    });

    res.status(200).json({ message: `Cancelled job date: ${formatted}` });

  } catch (err) {
    console.error('Error cancelling date:', err);
    res.status(500).json({ error: 'Failed to cancel job date' });
  }
});


// 📅 Fetch Fully Booked Job Dates (10 or more)
// 📋 Fetch jobs for a specific date (in EST)
router.get('/jobs', async (req, res) => {
  try {
    const { date } = req.query; // Expected format: YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const [year, month, day] = date.split('-').map(Number);
    const estMidnight = new Date(Date.UTC(year, month - 1, day));

    const startOfDay = new Date(estMidnight);
    const endOfDay = new Date(estMidnight);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const jobs = await ControlUser.find({
      jobDates: {
        $elemMatch: {
          date: { $gte: startOfDay, $lt: endOfDay },
          cancelled: false
        }
      }      
    });

    res.json(jobs);
  } catch (err) {
    console.error("Error fetching jobs for selected date:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// 📅 Get all jobs for a given month and year
router.get('/jobs/month', async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const monthInt = parseInt(month, 10) - 1; // JS months are 0-indexed
    const yearInt = parseInt(year, 10);

    const start = new Date(Date.UTC(yearInt, monthInt, 1));
    const end = new Date(Date.UTC(yearInt, monthInt + 1, 1));

    const jobs = await ControlUser.find({
      jobDates: {
        $elemMatch: {
          date: { $gte: start, $lt: end },
          cancelled: false
        }
      }      
    });

    res.json(jobs);
  } catch (err) {
    console.error("Error fetching monthly jobs:", err);
    res.status(500).json({ error: 'Failed to fetch monthly jobs' });
  }
});
// Add this route to fetch fully booked dates
router.get('/jobs/full-dates', async (req, res) => {
  try {
const pipeline = [
  { $match: { cancelled: { $ne: true } } },  // Exclude jobs that are entirely cancelled
  { $unwind: "$jobDates" },
  {
    $match: {
      "jobDates.date": { $exists: true },
      "jobDates.cancelled": { $ne: true }    // Exclude cancelled dates
    }
  },
  {
    $group: {
      _id: "$jobDates.date",
      count: { $sum: 1 }
    }
  },
  { $match: { count: { $gte: 10 } } }
];
    const result = await ControlUser.aggregate(pipeline);
    const fullDates = result.map(r =>
      new Date(r._id).toISOString().split('T')[0] // Format: YYYY-MM-DD
    );

    res.json(fullDates);
  } catch (err) {
    console.error("Failed to fetch full dates:", err);
    res.status(500).json({ error: 'Failed to fetch full dates' });
  }
});
router.get('/jobs/cancelled', async (req, res) => {
  try {
    const { year } = req.query;
    
    let matchCondition = {};
    
    if (year) {
      const yearInt = parseInt(year, 10);
      const startOfYear = new Date(Date.UTC(yearInt, 0, 1));
      const endOfYear = new Date(Date.UTC(yearInt + 1, 0, 1));
      
      matchCondition = {
        $or: [
          // Jobs that are entirely cancelled
          {
            cancelled: true,
            cancelledAt: { $gte: startOfYear, $lt: endOfYear }
          },
          // Jobs with specific cancelled dates
          {
            jobDates: {
              $elemMatch: {
                cancelled: true,
                cancelledAt: { $gte: startOfYear, $lt: endOfYear }
              }
            }
          }
        ]
      };
    } else {
      // Get all cancelled jobs if no year specified
      matchCondition = {
        $or: [
          { cancelled: true },
          { 'jobDates.cancelled': true }
        ]
      };
    }

    const cancelledJobs = await ControlUser.find(matchCondition);
    
    // Process the results to extract individual cancelled dates
    const processedCancelledJobs = [];
    
    cancelledJobs.forEach(job => {
      if (job.cancelled) {
        // Entire job was cancelled
        processedCancelledJobs.push({
          ...job.toObject(),
          cancelledDate: job.cancelledAt,
          cancelledType: 'entire_job'
        });
      } else {
        // Check for individual cancelled dates
        job.jobDates.forEach(jobDate => {
          if (jobDate.cancelled) {
            processedCancelledJobs.push({
              ...job.toObject(),
              cancelledDate: jobDate.cancelledAt || jobDate.date,
              originalJobDate: jobDate.date,
              cancelledType: 'single_date'
            });
          }
        });
      }
    });

    res.json(processedCancelledJobs);
  } catch (err) {
    console.error("Error fetching cancelled jobs:", err);
    res.status(500).json({ error: 'Failed to fetch cancelled jobs' });
  }
});
module.exports = router;

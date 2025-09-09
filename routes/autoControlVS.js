const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const { submitTrafficControlJob } = require('../controllers/autoControlControler');
const transporter = require('../utils/emailConfig');
const myEmail = 'tbsolutions9@gmail.com';
const ControlUser = require('../models/controluser'); // Import your model
const Invoice = require('../models/invoice');
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
        origin: 'http://localhost:5173'
    })
);

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// 🚦 Job Submission
router.post('/trafficcontrol', submitTrafficControlJob);
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

// 🗑️ Cancel a job by ID
router.delete('/cancel-job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const job = await ControlUser.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // If no ?date provided, cancel the whole job (existing logic)
if (!date) {
  job.cancelled = true;
  job.cancelledAt = new Date();
  await job.save();

  const formattedDates = job.jobDates.map(d =>
    new Date(d.date).toLocaleDateString('en-US')
  ).join(', ');

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
    subject: 'TRAFFIC CONTROL JOB CANCELLED',
    html: `
      <h2>Traffic Control Job Cancelled</h2>
      <p>Dear ${job.name},</p>
      <p>Your traffic control job scheduled for the following date(s) has been cancelled:</p>
      <ul>${job.jobDates.map(d => `<li>${new Date(d.date).toLocaleDateString('en-US')}</li>`).join('')}</ul>
      <p><strong>Project/Task Number:</strong> ${job.project}</p>
      <p><strong>Coordinator:</strong> ${job.coordinator}</p>
      <p><strong>Company:</strong> ${job.company}</p>
      <p><strong>Location:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>
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
      subject: 'TRAFFIC CONTROL DATE CANCELLED',
      html: `
        <h2>Job Date Cancelled</h2>
        <p>Dear ${job.name},</p>
        <p>The following job date has been cancelled:</p>
        <ul><li><strong>${formatted}</strong></li></ul>

        <p><strong>Project/Task Number:</strong> ${job.project}</p>
        <p><strong>Company:</strong> ${job.company}</p>
        <p><strong>Coordinator:</strong> ${job.coordinator}</p>
        <p><strong>Location:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>

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

const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const { submitTrafficControlJob } = require('../controllers/autoControlControler');
const transporter6 = require('../utils/emailConfig');
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
        /*origin: 'http://localhost:5173' // Make sure this matches your frontend */
        origin: 'https://www.trafficbarriersolutions.com'
    })
);

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// 🚦 Job Submission
router.post('/trafficcontrol', submitTrafficControlJob);
// 🗑️ Cancel a job by ID
router.delete('/cancel-job/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const job = await ControlUser.findById(id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
  
      job.cancelled = true;
      job.cancelledAt = new Date();
      await job.save();
  
      // ✅ Compose cancellation email
      const formattedDates = job.jobDates.map(d =>
        new Date(d.date).toLocaleDateString('en-US')
      ).join(', ');
      
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
        subject: 'TRAFFIC CONTROL JOB CANCELLED',
        html: `
          <h2>Traffic Control Job Cancelled</h2>
          <p>Dear ${job.name},</p>
          <p>Your traffic control job scheduled for <strong>${formattedDates}</strong> has been cancelled successfully.</p>
          <hr>
          <p><strong>Company:</strong> ${job.company}</p>
          <p><strong>Coordinator:</strong> ${job.coordinator}</p>
          <p><strong>Project:</strong> ${job.project}</p>
          <p><strong>Location:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>
          <hr>
          <p>If you want to reschedule, please <a href="https://www.trafficbarriersolutions.com/trafficcontrol">resubmit your request here</a>.</p>
          <p>— TBS Admin Team</p>
        `
      };
      
  
      // ✅ Send the cancellation email
      transporter6.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('Error sending cancellation email:', err);
        } else {
          console.log('Cancellation email sent:', info.response);
        }
      });
      res.status(200).json({ message: 'Job marked as cancelled' });
    } catch (err) {
      console.error('Error cancelling job:', err);
      res.status(500).json({ error: 'Failed to cancel job' });
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


module.exports = router;

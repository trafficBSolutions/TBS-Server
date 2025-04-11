const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const { submitTrafficControlJob } = require('../controllers/autoControlControler');
const transporter4 = require('../utils/emailConfig');
const myEmail = 'tbsolutions9@gmail.com';
const ControlUser = require('../models/controluser'); // Import your model
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
// Middleware
router.use(
    cors({
        credentials: true,
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
  
      const job = await ControlUser.findByIdAndDelete(id);
  
      if (!job) {
        return res.status(404).json({ error: 'Job not found or already cancelled' });
      }
  
      // ✅ Compose cancellation email
      const mailOptions = {
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: job.email,
        bcc: [
                { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
                 
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
                { name: 'Bryson Davis', address: mainEmail },
                { name: 'Jonkell Tolbert', address: foreemail }
                
            ],
        subject: 'TRAFFIC CONTROL JOB CANCELLED',
        html: `
          <h2>Traffic Control Job Cancelled</h2>
          <p>Dear ${job.name},</p>
          <p>Your traffic control job scheduled for <strong>${new Date(job.jobDate).toLocaleDateString()}</strong> has been cancelled successfully.</p>
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
      transporter4.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('Error sending cancellation email:', err);
        } else {
          console.log('Cancellation email sent:', info.response);
        }
      });
  
      res.status(200).json({ message: 'Job cancelled and email sent.' });
    } catch (error) {
      console.error('Error cancelling job:', error);
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  });

// 📅 Fetch Fully Booked Job Dates (10 or more)
router.get('/jobs/full-dates', async (req, res) => {
  try {
    // Get all jobs from the database
    const jobs = await ControlUser.find({});
    
    // Group jobs by date in EST timezone
    const dateCountMap = {};
    
    jobs.forEach(job => {
      // Convert UTC date to EST date string (YYYY-MM-DD)
      const date = new Date(job.jobDate);
      
      // Format date to EST timezone string
      const estDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
      
      // Convert MM/DD/YYYY to YYYY-MM-DD
      const [month, day, year] = estDate.split('/');
      const formattedDate = `${year}-${month}-${day}`;
      
      // Count jobs by date
      dateCountMap[formattedDate] = (dateCountMap[formattedDate] || 0) + 1;
    });
    
    // Find dates with 10 or more jobs
    const fullDates = Object.entries(dateCountMap)
      .filter(([_, count]) => count >= 10)
      .map(([date]) => date);
    
    res.json(fullDates);
  } catch (error) {
    console.error("Error fetching full dates:", error);
    res.status(500).json({ error: "Failed to fetch full job dates" });
  }
});

module.exports = router;

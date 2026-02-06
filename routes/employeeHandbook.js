const express = require('express');
const router = express.Router();
router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);

router.post('/api/employee-handbook', async (req, res) => {
  try {
    const { firstName, lastName, signature, hasRead } = req.body;

    if (!firstName || !lastName || !signature || !hasRead) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'tbsolutions1999@gmail.com',
      subject: 'Employee Handbook Acknowledgment',
      html: `
        <h2>Employee Handbook Acknowledgment</h2>
        <p><strong>Employee Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Signature:</strong> ${signature}</p>
        <p><strong>Acknowledged:</strong> ${hasRead ? 'Yes' : 'No'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Handbook acknowledgment submitted successfully' });
  } catch (error) {
    console.error('Error submitting handbook acknowledgment:', error);
    res.status(500).json({ error: 'Failed to submit acknowledgment' });
  }
});

module.exports = router;

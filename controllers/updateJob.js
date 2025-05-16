const ControlUser = require('../models/controluser');
const updateTrafficControlJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { updatedDates } = req.body;

    if (!Array.isArray(updatedDates) || updatedDates.length === 0) {
      return res.status(400).json({ error: 'No dates provided' });
    }

    const parsedDates = updatedDates.map(dateStr => ({
      date: new Date(dateStr),
      cancelled: false,
      cancelledAt: null
    }));

    const job = await ControlUser.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    job.jobDates = parsedDates;
    await job.save();

    // Send email notification
    // ... (email sending code)

    res.status(200).json({ message: 'Job updated successfully', job });
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
module.exports = updateTrafficControlJob

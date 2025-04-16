const cron = require('node-cron');
const ControlUser = require('../models/controluser');

// Runs every Monday at 2:00 AM
cron.schedule('0 2 * * 1', async () => {
  try {
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(now.getDate() - 14); // 14 days ago

    // Find 1 job older than 14 days, sorted by oldest first
    const oldJob = await ControlUser.findOne({ jobDate: { $lt: cutoffDate } }).sort({ jobDate: 1 });

    if (oldJob) {
      await ControlUser.findByIdAndDelete(oldJob._id);
      console.log(`[CLEANUP] Deleted job for company "${oldJob.company}" dated ${oldJob.jobDate.toDateString()}`);
    } else {
      console.log('[CLEANUP] No eligible jobs to delete this week.');
    }
  } catch (err) {
    console.error('[CLEANUP ERROR]', err);
  }
});
is keeps running as long as your server runs

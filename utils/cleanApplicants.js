const cron = require('node-cron');
const Apply = require('../models/newapply');
const fs = require('fs');
const path = require('path');

// Runs every day at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14); // 14 days ago

    // Find applicants older than 14 days
    const oldApplicants = await Apply.find({ createdAt: { $lt: cutoffDate } });

    if (oldApplicants.length === 0) {
      console.log('[APPLICANT CLEANUP] No applicants older than 14 days.');
      return;
    }

    // Delete associated files (resume/cover) from disk
    for (const applicant of oldApplicants) {
      if (applicant.resume) {
        const resumePath = path.join(__dirname, '..', 'files', applicant.resume);
        if (fs.existsSync(resumePath)) fs.unlinkSync(resumePath);
      }
      if (applicant.cover) {
        const coverPath = path.join(__dirname, '..', 'files', applicant.cover);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      }
    }

    // Delete from database
    const result = await Apply.deleteMany({ createdAt: { $lt: cutoffDate } });
    console.log(`[APPLICANT CLEANUP] Deleted ${result.deletedCount} applicants older than 14 days.`);
  } catch (err) {
    console.error('[APPLICANT CLEANUP ERROR]', err);
  }
});

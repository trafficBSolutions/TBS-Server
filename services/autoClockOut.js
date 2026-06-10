const cron = require('node-cron');
const TimeClock = require('../models/timeClock');
const { transporter } = require('../utils/emailConfig');

const ADMIN_EMAILS = [
  'tbsolutions9@gmail.com',
  'tbsolutions1995@gmail.com',
  'tbsolutions1999@gmail.com',
  'tbsolutions4@gmail.com',
  'tbsolutions77@gmail.com'
];

// Run at midnight every day
const startAutoClockOut = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[auto-clock-out] Running midnight check...');
    try {
      const openEntries = await TimeClock.find({ clockOut: null });

      if (openEntries.length === 0) {
        console.log('[auto-clock-out] No one left clocked in.');
        return;
      }

      const now = new Date();
      const forgotNames = [];

      for (const entry of openEntries) {
        // Only auto clock-out if they've been clocked in for more than 14 hours
        const hoursIn = (now - new Date(entry.clockIn)) / (1000 * 60 * 60);
        if (hoursIn < 14) {
          console.log(`[auto-clock-out] Skipping ${entry.employeeName} (only ${hoursIn.toFixed(1)} hrs, likely graveyard shift)`);
          continue;
        }

        entry.clockOut = now;
        entry.autoClockOut = true;
        if (!entry.originalClockIn) entry.originalClockIn = entry.clockIn;
        await entry.save();
        forgotNames.push(entry.employeeName);
        console.log(`[auto-clock-out] Clocked out: ${entry.employeeName} (was in ${hoursIn.toFixed(1)} hrs)`);
      }

      if (forgotNames.length === 0) {
        console.log('[auto-clock-out] All open entries are under 14 hrs (likely graveyard). No action taken.');
        return;
      }

      // Email admins
      const htmlList = forgotNames.map(n => `<li><strong>${n}</strong></li>`).join('');

      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: ADMIN_EMAILS.join(','),
        subject: `⚠️ Auto Clock-Out: ${forgotNames.length} employee(s) forgot to clock out`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;">
            <h2 style="color:#d32f2f;">⚠️ Employees Forgot to Clock Out</h2>
            <p>The following employee(s) were clocked in for over 14 hours and have been automatically clocked out at midnight:</p>
            <ul style="font-size:16px;line-height:2;">${htmlList}</ul>
            <p style="margin-top:20px;padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;">
              <strong>Action Required:</strong> Please contact these employees to determine when they actually left and edit their hours in the Time Clock admin panel.
            </p>
            <hr style="margin-top:30px;">
            <p style="font-size:12px;color:#888;">Traffic & Barrier Solutions, LLC — Automated System</p>
          </div>
        `
      });

      console.log(`[auto-clock-out] Email sent to admins about ${forgotNames.length} employee(s).`);
    } catch (e) {
      console.error('[auto-clock-out] Error:', e);
    }
  }, {
    timezone: 'America/New_York'
  });

  console.log('[auto-clock-out] Cron job scheduled for midnight EST (14+ hr threshold).');
};

module.exports = { startAutoClockOut };

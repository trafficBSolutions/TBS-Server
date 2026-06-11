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

const ALERT_AFTER_HOURS = 16;

const runAutoClockOut = async () => {
  console.log('[auto-clock-out] Running check (notification only, no auto clock-out)...');
  try {
    const openEntries = await TimeClock.find({ clockOut: null });

    if (openEntries.length === 0) {
      console.log('[auto-clock-out] No one left clocked in.');
      return;
    }

    const now = new Date();
    const longShiftNames = [];

    for (const entry of openEntries) {
      const hoursIn = (now - new Date(entry.clockIn)) / (1000 * 60 * 60);
      if (hoursIn >= ALERT_AFTER_HOURS) {
        longShiftNames.push(`${entry.employeeName} (clocked in ${hoursIn.toFixed(1)} hrs ago)`);
        console.log(`[auto-clock-out] ALERT: ${entry.employeeName} still clocked in (${hoursIn.toFixed(1)} hrs) — NOT auto-clocking out`);
      }
    }

    if (longShiftNames.length === 0) {
      console.log(`[auto-clock-out] All open entries under ${ALERT_AFTER_HOURS} hrs. No alerts.`);
      return;
    }

    const htmlList = longShiftNames.map(n => `<li><strong>${n}</strong></li>`).join('');

    await transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: ADMIN_EMAILS.join(','),
      subject: `⚠️ ${longShiftNames.length} employee(s) still clocked in (${ALERT_AFTER_HOURS}+ hrs)`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;">
          <h2 style="color:#d32f2f;">⚠️ Employees Still Clocked In</h2>
          <p>The following employee(s) have been clocked in for over ${ALERT_AFTER_HOURS} hours and may have forgotten to clock out:</p>
          <ul style="font-size:16px;line-height:2;">${htmlList}</ul>
          <p style="margin-top:20px;padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;">
            <strong>Action Required:</strong> Please contact these employees and manually edit their hours if needed. They have NOT been auto-clocked out.
          </p>
          <hr style="margin-top:30px;">
          <p style="font-size:12px;color:#888;">Traffic & Barrier Solutions, LLC — Automated System</p>
        </div>
      `
    });

    console.log(`[auto-clock-out] Alert email sent about ${longShiftNames.length} employee(s).`);
  } catch (e) {
    console.error('[auto-clock-out] Error:', e);
  }
};

const startAutoClockOut = () => {
  // Run at 6:00 AM EST only — just sends alerts, never clocks anyone out
  cron.schedule('0 6 * * *', runAutoClockOut, { timezone: 'America/New_York' });

  console.log(`[auto-clock-out] Scheduled: 6AM EST (alert only after ${ALERT_AFTER_HOURS}hrs, NO auto clock-out).`);
};

module.exports = { startAutoClockOut };

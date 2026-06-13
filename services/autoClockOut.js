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

const MAX_SHIFT_HOURS = 14;

const runAutoClockOut = async () => {
  console.log('[auto-clock-out] Running check...');
  try {
    const openEntries = await TimeClock.find({ clockOut: null });

    if (openEntries.length === 0) {
      console.log('[auto-clock-out] No one left clocked in.');
      return;
    }

    const now = new Date();
    const forgotNames = [];

    for (const entry of openEntries) {
      const hoursIn = (now - new Date(entry.clockIn)) / (1000 * 60 * 60);
      if (hoursIn < MAX_SHIFT_HOURS) {
        console.log(`[auto-clock-out] Skipping ${entry.employeeName} (${hoursIn.toFixed(1)} hrs - under ${MAX_SHIFT_HOURS}hr threshold)`);
        continue;
      }

      const clockOutTime = now;
      entry.clockOut = clockOutTime;
      entry.autoClockOut = true;
      if (!entry.originalClockIn) entry.originalClockIn = entry.clockIn;
      await entry.save();

      // Split if crosses Friday-Saturday midnight (pay period boundary)
      const clockInTime = new Date(entry.clockIn);
      const clockInDay = clockInTime.getDay(); // 0=Sun,5=Fri,6=Sat
      const clockOutDay = clockOutTime.getDay();
      if (clockInDay !== 6 && (clockOutDay === 6 || (clockInTime.toDateString() !== clockOutTime.toDateString() && clockInDay === 5))) {
        const satMidnight = new Date(clockInTime);
        const daysUntilSat = (6 - clockInDay + 7) % 7 || 7;
        satMidnight.setDate(clockInTime.getDate() + daysUntilSat);
        satMidnight.setHours(0, 0, 0, 0);
        if (satMidnight > clockInTime && satMidnight < clockOutTime) {
          entry.clockOut = satMidnight;
          await entry.save();
          await TimeClock.create({
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            clockIn: satMidnight,
            clockOut: clockOutTime,
            purpose: entry.purpose || null,
            autoClockOut: true,
            ip: 'auto-clock-out (split)'
          });
          console.log(`[auto-clock-out] Split at pay period boundary: ${entry.employeeName}`);
        }
      }

      forgotNames.push(`${entry.employeeName} (clocked in ${hoursIn.toFixed(1)} hrs ago)`);
      console.log(`[auto-clock-out] Clocked out: ${entry.employeeName} (was in ${hoursIn.toFixed(1)} hrs)`);
    }

    if (forgotNames.length === 0) {
      console.log(`[auto-clock-out] All open entries under ${MAX_SHIFT_HOURS} hrs. No action taken.`);
      return;
    }

    const htmlList = forgotNames.map(n => `<li><strong>${n}</strong></li>`).join('');

    await transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: ADMIN_EMAILS.join(','),
      subject: `\u26a0\ufe0f Auto Clock-Out: ${forgotNames.length} employee(s) forgot to clock out`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;">
          <h2 style="color:#d32f2f;">\u26a0\ufe0f Employees Forgot to Clock Out</h2>
          <p>The following employee(s) were clocked in for over ${MAX_SHIFT_HOURS} hours and have been automatically clocked out:</p>
          <ul style="font-size:16px;line-height:2;">${htmlList}</ul>
          <p style="margin-top:20px;padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;">
            <strong>Action Required:</strong> Please contact these employees to determine when they actually left and edit their hours in the Time Clock admin panel.
          </p>
          <hr style="margin-top:30px;">
          <p style="font-size:12px;color:#888;">Traffic & Barrier Solutions, LLC \u2014 Automated System</p>
        </div>
      `
    });

    console.log(`[auto-clock-out] Email sent to admins about ${forgotNames.length} employee(s).`);
  } catch (e) {
    console.error('[auto-clock-out] Error:', e);
  }
};

const startAutoClockOut = () => {
  // Run at midnight EST
  cron.schedule('0 0 * * *', runAutoClockOut, { timezone: 'America/New_York' });
  // Run at 6:00 AM EST (catches graveyard workers who forgot)
  cron.schedule('0 6 * * *', runAutoClockOut, { timezone: 'America/New_York' });

  console.log(`[auto-clock-out] Scheduled: midnight & 6AM EST (${MAX_SHIFT_HOURS}hr threshold, with pay period split).`);
};

module.exports = { startAutoClockOut };

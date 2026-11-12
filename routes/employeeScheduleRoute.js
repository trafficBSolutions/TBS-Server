const express = require('express');
const router = express.Router();
const EmployeeSchedule = require('../models/employeeSchedule');
const TimeClock = require('../models/timeClock');
const TimeClockEmployee = require('../models/timeClockEmployee');
const { transporter } = require('../utils/emailConfig');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com'];

// Dasia Diskey auto-schedule: M-F 8:45am Shop Work
// This is injected at read-time so it doesn't need to be stored
const DASIA_SCHEDULE = {
  clockInTime: '08:45',
  purpose: 'Shop Work',
  employeeName: 'Dasia Diskey',
};

const getDayOfWeek = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay(); // 0=Sun, 6=Sat
};

const isWeekday = (dateStr) => {
  const day = getDayOfWeek(dateStr);
  return day >= 1 && day <= 5;
};

// Inject Dasia into a schedule doc's assignments if it's a weekday
const injectDasia = async (dateStr, assignments) => {
  if (!isWeekday(dateStr)) return assignments;
  // Find Dasia's employee record
  const dasia = await TimeClockEmployee.findOne({
    firstName: { $regex: /^dasia$/i },
    lastName: { $regex: /^diskey$/i },
    active: true,
  });
  if (!dasia) return assignments;
  const alreadyIn = assignments.some(a => a.employeeId?.toString() === dasia._id.toString());
  if (alreadyIn) return assignments;
  return [
    {
      employeeId: dasia._id,
      employeeName: `${dasia.firstName} ${dasia.lastName}`,
      clockInTime: DASIA_SCHEDULE.clockInTime,
      purpose: DASIA_SCHEDULE.purpose,
    },
    ...assignments,
  ];
};

// GET /employee-schedule/:date
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    let doc = await EmployeeSchedule.findOne({ date });
    const assignments = await injectDasia(date, doc?.assignments || []);
    return res.json({ date, assignments });
  } catch (e) {
    console.error('Get schedule error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /employee-schedule/month/:yearMonth  e.g. 2026-06
router.get('/month/:yearMonth', async (req, res) => {
  try {
    const { yearMonth } = req.params;
    const [year, month] = yearMonth.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 1); // first day of next month
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
    const docs = await EmployeeSchedule.find({ date: { $gte: start, $lt: end } });
    // Build map date -> count (including Dasia injection)
    const result = {};
    for (const doc of docs) {
      const assignments = await injectDasia(doc.date, doc.assignments || []);
      if (assignments.length > 0) result[doc.date] = assignments.length;
    }
    // Also inject Dasia for weekdays that have no doc
    const dasia = await TimeClockEmployee.findOne({ firstName: /^dasia$/i, lastName: /^diskey$/i, active: true });
    if (dasia) {
      const d = new Date(start + 'T12:00:00');
      while (d.toISOString().split('T')[0] < end) {
        const ds = d.toISOString().split('T')[0];
        if (isWeekday(ds) && !result[ds]) result[ds] = 1;
        d.setDate(d.getDate() + 1);
      }
    }
    return res.json(result);
  } catch (e) {
    console.error('Get month schedule error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /employee-schedule/:date  — upsert assignments for a day
router.post('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { assignments } = req.body; // array of { employeeId, employeeName, clockInTime, purpose }
    if (!Array.isArray(assignments)) return res.status(400).json({ message: 'assignments array required' });

    const doc = await EmployeeSchedule.findOneAndUpdate(
      { date },
      { date, assignments },
      { upsert: true, new: true }
    );
    return res.json(doc);
  } catch (e) {
    console.error('Save schedule error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /employee-schedule/:date/:employeeId — remove one assignment
router.delete('/:date/:employeeId', async (req, res) => {
  try {
    const { date, employeeId } = req.params;
    await EmployeeSchedule.findOneAndUpdate(
      { date },
      { $pull: { assignments: { employeeId } } }
    );
    return res.json({ message: 'Removed' });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /employee-schedule/check/:employeeId?date=YYYY-MM-DD
// Returns the scheduled assignment for an employee on a given date (used by kiosk)
router.get('/check/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date required' });

    // Check Dasia auto-schedule
    const emp = await TimeClockEmployee.findById(employeeId);
    if (emp) {
      const fullName = `${emp.firstName} ${emp.lastName}`;
      if (/dasia diskey/i.test(fullName) && isWeekday(date)) {
        return res.json({
          scheduled: true,
          clockInTime: DASIA_SCHEDULE.clockInTime,
          purpose: DASIA_SCHEDULE.purpose,
          employeeName: fullName,
        });
      }
    }

    const doc = await EmployeeSchedule.findOne({ date });
    if (!doc) return res.json({ scheduled: false });
    const assignment = doc.assignments.find(a => a.employeeId?.toString() === employeeId);
    if (!assignment) return res.json({ scheduled: false });
    return res.json({
      scheduled: true,
      clockInTime: assignment.clockInTime,
      purpose: assignment.purpose,
      employeeName: assignment.employeeName,
    });
  } catch (e) {
    console.error('Check schedule error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /employee-schedule/notify-late  — called by kiosk after 15 min past scheduled time
router.post('/notify-late', async (req, res) => {
  try {
    const { employeeName, scheduledTime, date } = req.body;
    await transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS.join(','),
      subject: `⚠️ LATE: ${employeeName} has not clocked in`,
      html: `<h2>Late Clock-In Notice</h2>
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Scheduled Clock-In:</strong> ${scheduledTime}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p>${employeeName} was scheduled to clock in at ${scheduledTime} and has not clocked in yet (15+ minutes late).</p>`,
    });
    return res.json({ message: 'Late notice sent' });
  } catch (e) {
    console.error('Late notify error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /employee-schedule/notify-noshow  — called after 45 min
router.post('/notify-noshow', async (req, res) => {
  try {
    const { employeeName, scheduledTime, date } = req.body;
    await transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS.join(','),
      subject: `🚨 NO SHOW: ${employeeName} may not have shown up`,
      html: `<h2>Possible No-Show Alert</h2>
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Scheduled Clock-In:</strong> ${scheduledTime}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p>${employeeName} was scheduled to clock in at ${scheduledTime} and has still not clocked in (45+ minutes late). They may not have shown up.</p>`,
    });
    return res.json({ message: 'No-show notice sent' });
  } catch (e) {
    console.error('No-show notify error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

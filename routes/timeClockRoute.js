const express = require('express');
const router = express.Router();
const TimeClock = require('../models/timeClock');
const TimeClockEmployee = require('../models/timeClockEmployee');
const DisciplineEmployee = require('../models/disciplineEmployee');
const Admin = require('../models/Admin');
const Discipline = require('../models/discipline');

// Allowed IPs - only this location can clock in/out
const ALLOWED_IPS = [
  '73.82.211.177',
  '2603:3001:3502:8200:8cad:404c:a3de:4443',
  '::ffff:73.82.211.177',
  '127.0.0.1',
  '::1'
];

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
};

const verifyIp = (req, res, next) => {
  const clientIp = getClientIp(req);
  const allowed = ALLOWED_IPS.some(ip => clientIp === ip) ||
    clientIp.startsWith('2603:3001:3502:8200:');
  if (!allowed) {
    return res.status(403).json({ message: 'Clock-in/out is only allowed from the designated work location.', ip: clientIp });
  }
  req.clientIp = clientIp;
  next();
};

// Look up person by PIN (checks TimeClockEmployee roster first, then hourly admins)
const findPersonByPin = async (pin) => {
  const emp = await TimeClockEmployee.findOne({ pin, active: true });
  if (emp) return { id: emp._id, name: `${emp.firstName} ${emp.lastName}`, type: 'Employee' };

  const admin = await Admin.findOne({ pin });
  if (admin) return { id: admin._id, name: `${admin.firstName} ${admin.lastName || ''}`, type: 'Admin' };

  return null;
};

// POST /timeclock/punch
router.post('/punch', verifyIp, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required' });

    const person = await findPersonByPin(pin);
    if (!person) return res.status(401).json({ message: 'Invalid PIN' });

    // Check for unacknowledged disciplines
    const pendingDisciplines = await Discipline.find({
      linkedPersonId: person.id,
      acknowledged: false
    }).sort({ createdAt: -1 });

    const pendingByName = await Discipline.find({
      employeeName: { $regex: new RegExp(`^${person.name.trim()}$`, 'i') },
      linkedPersonId: { $exists: false },
      acknowledged: false
    }).sort({ createdAt: -1 });

    const allPending = [...pendingDisciplines, ...pendingByName];

    const openEntry = await TimeClock.findOne({ employeeId: person.id, clockOut: null });

    if (openEntry) {
      if (allPending.length > 0) {
        return res.status(403).json({
          message: 'You must review and acknowledge your disciplinary action(s) before clocking out.',
          action: 'discipline_required',
          disciplines: allPending,
          personId: person.id,
          personName: person.name
        });
      }
      openEntry.clockOut = new Date();
      await openEntry.save();
      return res.json({ action: 'clocked_out', message: `${person.name} clocked out.`, record: openEntry });
    } else {
      if (allPending.length > 0) {
        return res.status(403).json({
          message: 'You must review and acknowledge your disciplinary action(s) before clocking in.',
          action: 'discipline_required',
          disciplines: allPending,
          personId: person.id,
          personName: person.name
        });
      }
      const entry = await TimeClock.create({
        employeeId: person.id,
        employeeName: person.name,
        clockIn: new Date(),
        ip: req.clientIp
      });
      return res.json({ action: 'clocked_in', message: `${person.name} clocked in.`, record: entry });
    }
  } catch (e) {
    console.error('TimeClock punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/acknowledge-discipline
router.post('/acknowledge-discipline', verifyIp, async (req, res) => {
  try {
    const { pin, disciplineId, typedName } = req.body;
    if (!pin || !disciplineId || !typedName) {
      return res.status(400).json({ message: 'PIN, disciplineId, and typed name are required' });
    }

    const person = await findPersonByPin(pin);
    if (!person) return res.status(401).json({ message: 'Invalid PIN' });

    if (typedName.trim().toLowerCase() !== person.name.trim().toLowerCase()) {
      return res.status(400).json({ message: 'Typed name does not match your name on file. Please type your full name exactly.' });
    }

    const discipline = await Discipline.findById(disciplineId);
    if (!discipline) return res.status(404).json({ message: 'Discipline record not found' });

    discipline.acknowledged = true;
    discipline.acknowledgedAt = new Date();
    discipline.acknowledgedName = typedName.trim();
    if (!discipline.linkedPersonId) {
      discipline.linkedPersonId = person.id;
      discipline.linkedPersonType = person.type;
    }
    await discipline.save();

    const remaining = await Discipline.find({
      $or: [
        { linkedPersonId: person.id, acknowledged: false },
        { employeeName: { $regex: new RegExp(`^${person.name.trim()}$`, 'i') }, linkedPersonId: { $exists: false }, acknowledged: false }
      ]
    });

    return res.json({ message: 'Disciplinary action acknowledged.', remainingCount: remaining.length, remaining });
  } catch (e) {
    console.error('Acknowledge discipline error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/status - who's currently clocked in
router.get('/status', async (req, res) => {
  try {
    const clockedIn = await TimeClock.find({ clockOut: null }).sort({ clockIn: -1 });
    return res.json(clockedIn);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/history?date=YYYY-MM-DD
router.get('/history', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date required' });
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const records = await TimeClock.find({ clockIn: { $gte: start, $lt: end } }).sort({ clockIn: -1 });
    return res.json(records);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/employees - List all time clock employees and hourly admins
router.get('/employees', async (req, res) => {
  try {
    const employees = await TimeClockEmployee.find({ active: true }).select('firstName lastName position pin').sort({ firstName: 1 });
    const hourlyAdminEmails = ['tbsolutions77@gmail.com', 'tbsolutions14@gmail.com', 'tbsolutions66@gmail.com'];
    const hourlyAdmins = await Admin.find({ email: { $in: hourlyAdminEmails } }).select('firstName lastName email pin').sort({ firstName: 1 });
    return res.json({
      employees: employees.map(e => ({ _id: e._id, name: `${e.firstName} ${e.lastName}`, position: e.position, pin: e.pin, type: 'Employee' })),
      hourlyAdmins: hourlyAdmins.map(a => ({ _id: a._id, name: `${a.firstName} ${a.lastName || ''}`, email: a.email, pin: a.pin || null, type: 'Admin' }))
    });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/add-employee - Add a new employee to the time clock roster
router.post('/add-employee', async (req, res) => {
  try {
    const { firstName, lastName, position, pin } = req.body;
    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }
    if (!position) {
      return res.status(400).json({ message: 'Position is required' });
    }
    if (!pin || pin.length < 4) {
      return res.status(400).json({ message: 'PIN must be at least 4 digits' });
    }

    // Check PIN uniqueness
    const existsEmp = await TimeClockEmployee.findOne({ pin });
    const existsAdmin = await Admin.findOne({ pin });
    if (existsEmp || existsAdmin) return res.status(409).json({ message: 'That PIN is already in use. Choose a different one.' });

    const emp = await TimeClockEmployee.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      position,
      pin
    });

    // Also add to DisciplineEmployee roster so they appear on the disciplinary action page
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const existingDisciplineEmp = await DisciplineEmployee.findOne({ name: { $regex: new RegExp(`^${fullName}$`, 'i') } });
    if (!existingDisciplineEmp) {
      await DisciplineEmployee.create({ name: fullName, position, totalPoints: 0 });
    }

    return res.status(201).json({
      message: `${firstName} ${lastName} (${position}) added with PIN: ${pin}`,
      employee: { _id: emp._id, name: fullName, position, pin, type: 'Employee' }
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'That PIN is already in use' });
    console.error('Add employee error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /timeclock/update-pin - Change PIN for an employee or hourly admin
router.put('/update-pin', async (req, res) => {
  try {
    const { employeeId, adminId, pin } = req.body;
    if ((!employeeId && !adminId) || !pin) return res.status(400).json({ message: 'id and pin required' });
    if (pin.length < 4) return res.status(400).json({ message: 'PIN must be at least 4 digits' });

    const existsEmp = await TimeClockEmployee.findOne({ pin, _id: { $ne: employeeId || null } });
    const existsAdmin = await Admin.findOne({ pin, _id: { $ne: adminId || null } });
    if (existsEmp || existsAdmin) return res.status(409).json({ message: 'That PIN is already in use' });

    if (employeeId) {
      const emp = await TimeClockEmployee.findByIdAndUpdate(employeeId, { pin }, { new: true });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });
      return res.json({ message: `PIN updated for ${emp.firstName} ${emp.lastName}`, pin, name: `${emp.firstName} ${emp.lastName}` });
    } else {
      const adm = await Admin.findByIdAndUpdate(adminId, { pin }, { new: true });
      if (!adm) return res.status(404).json({ message: 'Admin not found' });
      return res.json({ message: `PIN updated for ${adm.firstName} ${adm.lastName || ''}`, pin, name: `${adm.firstName} ${adm.lastName || ''}` });
    }
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/time-worked?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Total time worked per employee
router.get('/time-worked', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate required' });
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    const records = await TimeClock.find({
      clockIn: { $gte: start, $lt: end },
      clockOut: { $ne: null }
    }).sort({ clockIn: 1 });

    // Group by employee and calculate total minutes
    const summary = {};
    records.forEach(r => {
      const name = r.employeeName;
      if (!summary[name]) summary[name] = { totalMinutes: 0, days: {} };
      const mins = Math.round((new Date(r.clockOut) - new Date(r.clockIn)) / 60000);
      summary[name].totalMinutes += mins;
      const dayKey = new Date(r.clockIn).toISOString().split('T')[0];
      if (!summary[name].days[dayKey]) summary[name].days[dayKey] = 0;
      summary[name].days[dayKey] += mins;
    });

    // Convert to array
    const result = Object.entries(summary).map(([name, data]) => ({
      name,
      totalMinutes: data.totalMinutes,
      totalHours: (data.totalMinutes / 60).toFixed(2),
      days: data.days
    })).sort((a, b) => a.name.localeCompare(b.name));

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/check-ip
router.get('/check-ip', (req, res) => {
  const clientIp = getClientIp(req);
  const allowed = ALLOWED_IPS.some(ip => clientIp === ip) ||
    clientIp.startsWith('2603:3001:3502:8200:');
  return res.json({ allowed, ip: clientIp });
});

module.exports = router;

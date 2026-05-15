const express = require('express');
const router = express.Router();
const TimeClock = require('../models/timeClock');
const Employee = require('../models/employee');
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
  // Check if IP matches or starts with the allowed IPv6 prefix
  const allowed = ALLOWED_IPS.some(ip => clientIp === ip) ||
    clientIp.startsWith('2603:3001:3502:8200:');
  if (!allowed) {
    return res.status(403).json({ message: 'Clock-in/out is only allowed from the designated work location.', ip: clientIp });
  }
  req.clientIp = clientIp;
  next();
};

// POST /timeclock/punch - Clock in or out using PIN
router.post('/punch', verifyIp, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required' });

    // Check employees first, then admins
    let person = await Employee.findOne({ pin, active: true });
    let personName;
    let personId;

    if (person) {
      personName = `${person.firstName} ${person.lastName}`;
      personId = person._id;
    } else {
      const admin = await Admin.findOne({ pin });
      if (!admin) return res.status(401).json({ message: 'Invalid PIN' });
      personName = `${admin.firstName} ${admin.lastName || ''}`;
      personId = admin._id;
    }

    // Check for unacknowledged disciplines
    const pendingDisciplines = await Discipline.find({
      linkedPersonId: personId,
      acknowledged: false
    }).sort({ createdAt: -1 });

    // Also check by name match if no linkedPersonId set
    const pendingByName = await Discipline.find({
      employeeName: { $regex: new RegExp(`^${personName.trim()}$`, 'i') },
      linkedPersonId: { $exists: false },
      acknowledged: false
    }).sort({ createdAt: -1 });

    const allPending = [...pendingDisciplines, ...pendingByName];

    // Check if already clocked in
    const openEntry = await TimeClock.findOne({ employeeId: personId, clockOut: null });

    if (openEntry) {
      // Trying to clock OUT - block if unacknowledged disciplines exist
      if (allPending.length > 0) {
        return res.status(403).json({
          message: 'You must review and acknowledge your disciplinary action(s) before clocking out.',
          action: 'discipline_required',
          disciplines: allPending,
          personId,
          personName
        });
      }
      // Clock OUT
      openEntry.clockOut = new Date();
      await openEntry.save();
      return res.json({
        action: 'clocked_out',
        message: `${personName} clocked out.`,
        record: openEntry
      });
    } else {
      // Trying to clock IN - if pending disciplines, require acknowledgment first
      if (allPending.length > 0) {
        return res.status(403).json({
          message: 'You must review and acknowledge your disciplinary action(s) before clocking in.',
          action: 'discipline_required',
          disciplines: allPending,
          personId,
          personName
        });
      }
      // Clock IN
      const entry = await TimeClock.create({
        employeeId: personId,
        employeeName: personName,
        clockIn: new Date(),
        ip: req.clientIp
      });
      return res.json({
        action: 'clocked_in',
        message: `${personName} clocked in.`,
        record: entry
      });
    }
  } catch (e) {
    console.error('TimeClock punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/acknowledge-discipline - Employee acknowledges discipline by typing their name
router.post('/acknowledge-discipline', verifyIp, async (req, res) => {
  try {
    const { pin, disciplineId, typedName } = req.body;
    if (!pin || !disciplineId || !typedName) {
      return res.status(400).json({ message: 'PIN, disciplineId, and typed name are required' });
    }

    // Verify PIN
    let person = await Employee.findOne({ pin, active: true });
    let personName, personId;
    if (person) {
      personName = `${person.firstName} ${person.lastName}`;
      personId = person._id;
    } else {
      const admin = await Admin.findOne({ pin });
      if (!admin) return res.status(401).json({ message: 'Invalid PIN' });
      personName = `${admin.firstName} ${admin.lastName || ''}`;
      personId = admin._id;
    }

    // Verify typed name matches (case-insensitive)
    if (typedName.trim().toLowerCase() !== personName.trim().toLowerCase()) {
      return res.status(400).json({ message: 'Typed name does not match your name on file. Please type your full name exactly.' });
    }

    // Acknowledge the discipline
    const discipline = await Discipline.findById(disciplineId);
    if (!discipline) return res.status(404).json({ message: 'Discipline record not found' });

    discipline.acknowledged = true;
    discipline.acknowledgedAt = new Date();
    discipline.acknowledgedName = typedName.trim();
    if (!discipline.linkedPersonId) {
      discipline.linkedPersonId = personId;
      discipline.linkedPersonType = person ? 'Employee' : 'Admin';
    }
    await discipline.save();

    // Check if more pending
    const remaining = await Discipline.find({
      $or: [
        { linkedPersonId: personId, acknowledged: false },
        { employeeName: { $regex: new RegExp(`^${personName.trim()}$`, 'i') }, linkedPersonId: { $exists: false }, acknowledged: false }
      ]
    });

    return res.json({
      message: 'Disciplinary action acknowledged.',
      remainingCount: remaining.length,
      remaining
    });
  } catch (e) {
    console.error('Acknowledge discipline error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/status - Admin only: who's currently clocked in
router.get('/status', async (req, res) => {
  try {
    const clockedIn = await TimeClock.find({ clockOut: null }).sort({ clockIn: -1 });
    return res.json(clockedIn);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/history?date=YYYY-MM-DD - Admin: day's records
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

// POST /timeclock/set-pin - Set/update employee or admin PIN (admin use)
router.post('/set-pin', async (req, res) => {
  try {
    const { employeeId, adminId, pin } = req.body;
    if ((!employeeId && !adminId) || !pin) return res.status(400).json({ message: 'id and pin required' });
    if (pin.length < 4) return res.status(400).json({ message: 'PIN must be at least 4 digits' });

    // Check uniqueness across both collections
    const existingEmp = await Employee.findOne({ pin, _id: { $ne: employeeId || null } });
    const existingAdmin = await Admin.findOne({ pin, _id: { $ne: adminId || null } });
    if (existingEmp || existingAdmin) return res.status(409).json({ message: 'PIN already in use' });

    if (employeeId) {
      const emp = await Employee.findByIdAndUpdate(employeeId, { pin }, { new: true });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });
      return res.json({ message: `PIN set for ${emp.firstName} ${emp.lastName}` });
    } else {
      const adm = await Admin.findByIdAndUpdate(adminId, { pin }, { new: true });
      if (!adm) return res.status(404).json({ message: 'Admin not found' });
      return res.json({ message: `PIN set for ${adm.firstName} ${adm.lastName || ''}` });
    }
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/check-ip - Check if current IP is allowed (for frontend UI)
router.get('/check-ip', (req, res) => {
  const clientIp = getClientIp(req);
  const allowed = ALLOWED_IPS.some(ip => clientIp === ip) ||
    clientIp.startsWith('2603:3001:3502:8200:');
  return res.json({ allowed, ip: clientIp });
});

module.exports = router;

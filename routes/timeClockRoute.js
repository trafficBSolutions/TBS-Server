const express = require('express');
const router = express.Router();
const TimeClock = require('../models/timeClock');
const TimeClockEmployee = require('../models/timeClockEmployee');
const DisciplineEmployee = require('../models/disciplineEmployee');
const Admin = require('../models/Admin');
const Discipline = require('../models/discipline');
const ShopWorkOrder = require('../models/shopWorkOrder');
const WorkOrder = require('../models/workorder');
const { transporter } = require('../utils/emailConfig');
const { generateDisciplinePdf } = require('../services/disciplinePDF');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com'];

// Helper: get Eastern Time UTC offset in hours (handles DST automatically)
// Returns positive number (4 for EDT, 5 for EST) to ADD to local time to get UTC
const getETOffset = (date) => {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const etDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return (utcDate - etDate) / (1000 * 60 * 60);
};

// Allowed IPs from environment variables
const ALLOWED_IPS = [
  process.env.TIMECLOCK_IPV4,
  process.env.TIMECLOCK_IPV6,
  process.env.TIMECLOCK_IPV4 ? `::ffff:${process.env.TIMECLOCK_IPV4}` : null,
  '127.0.0.1',
  '::1'
].filter(Boolean);

const IPV6_PREFIX = process.env.TIMECLOCK_IPV6_PREFIX || '';

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
};

const verifyIp = (req, res, next) => {
  const clientIp = getClientIp(req);
  const allowed = ALLOWED_IPS.some(ip => clientIp === ip) ||
    (IPV6_PREFIX && clientIp.startsWith(IPV6_PREFIX));
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
    const { pin, purpose } = req.body;
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
      const clockOutTime = new Date();
      openEntry.clockOut = clockOutTime;
      await openEntry.save();

      // Split punch if it crosses Friday midnight (pay period boundary: Sat-Fri)
      // Use Eastern time for day-of-week calculation
      const getEasternDay = (date) => {
        const eastern = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        return eastern.getDay();
      };
      const getEasternMidnightSaturday = (fromDate) => {
        // Find next Saturday midnight in Eastern, return as UTC Date
        const eastern = new Date(fromDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const dayOfWeek = eastern.getDay();
        const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
        eastern.setDate(eastern.getDate() + daysUntilSat);
        eastern.setHours(0, 0, 0, 0);
        // Convert back: Saturday midnight Eastern = +4 or +5 UTC depending on DST
        const satStr = `${eastern.getFullYear()}-${String(eastern.getMonth()+1).padStart(2,'0')}-${String(eastern.getDate()).padStart(2,'0')}T04:00:00.000Z`;
        // Use 04:00 UTC for EDT, would be 05:00 for EST — approximate with fixed offset for now
        return new Date(satStr);
      };

      const clockInTime = new Date(openEntry.clockIn);
      const clockInDayET = getEasternDay(clockInTime);
      const clockOutDayET = getEasternDay(clockOutTime);

      // Only split if clocked in on Friday (5) or earlier and clocked out on Saturday (6) or later
      if (clockInDayET !== 6 && clockOutDayET === 6 && clockInTime.toDateString() !== clockOutTime.toDateString()) {
        const satMidnight = getEasternMidnightSaturday(clockInTime);
        if (satMidnight > clockInTime && satMidnight < clockOutTime) {
          openEntry.clockOut = satMidnight;
          await openEntry.save();
          await TimeClock.create({
            employeeId: person.id,
            employeeName: person.name,
            clockIn: satMidnight,
            clockOut: clockOutTime,
            purpose: openEntry.purpose || null,
            ip: req.clientIp + ' (split)'
          });
          return res.json({ action: 'clocked_out', message: `${person.name} clocked out. Shift split at midnight (pay period boundary).`, record: openEntry });
        }
      }

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
        purpose: purpose || null,
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
    const { pin, disciplineId, typedName, employeeStatement } = req.body;
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
    if (employeeStatement) discipline.employeeStatement = employeeStatement;
    if (!discipline.linkedPersonId) {
      discipline.linkedPersonId = person.id;
      discipline.linkedPersonType = person.type;
    }
    await discipline.save();

    // Send updated PDF with signatures to admins
    try {
      const pdfBuffer = await generateDisciplinePdf(discipline.toObject ? discipline.toObject() : discipline);
      const dateStr = discipline.incidentDate ? new Date(discipline.incidentDate).toLocaleDateString() : '';
      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: NOTIFY_EMAILS.join(','),
        subject: `ACKNOWLEDGED: ${discipline.employeeName} – Disciplinary Action ${dateStr}`,
        html: `<h2>Disciplinary Action Acknowledged</h2>
          <p><strong>Employee:</strong> ${discipline.employeeName}</p>
          <p><strong>Signed By:</strong> ${typedName.trim()}</p>
          <p><strong>Acknowledged At:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Supervisor:</strong> ${discipline.supervisorName || ''}</p>
          ${employeeStatement ? `<p><strong>Employee Statement:</strong> ${employeeStatement}</p>` : ''}
          <p>Updated PDF with employee signature attached.</p>`,
        attachments: [{
          filename: `Discipline_${discipline.employeeName.replace(/\s+/g, '_')}_SIGNED.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
    } catch (emailErr) {
      console.error('Discipline acknowledgment email failed:', emailErr);
    }

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

// GET /timeclock/employees - List all time clock employees and hourly admins with points
router.get('/employees', async (req, res) => {
  try {
    const employees = await TimeClockEmployee.find({ active: true }).select('firstName lastName position pin').sort({ firstName: 1 });
    const hourlyAdminEmails = ['tbsolutions77@gmail.com', 'tbsolutions14@gmail.com', 'tbsolutions66@gmail.com'];
    const hourlyAdmins = await Admin.find({ email: { $in: hourlyAdminEmails } }).select('firstName lastName email pin').sort({ firstName: 1 });

    // Ensure hourly admins exist in DisciplineEmployee roster
    for (const a of hourlyAdmins) {
      const fullName = `${a.firstName} ${a.lastName || ''}`.trim();
      const exists = await DisciplineEmployee.findOne({ name: { $regex: new RegExp(`^${fullName}$`, 'i') } });
      if (!exists) {
        await DisciplineEmployee.create({ name: fullName, position: 'Foreman', totalPoints: 0 });
      }
    }

    // Get discipline points for each employee
    const empList = await Promise.all(employees.map(async (e) => {
      const fullName = `${e.firstName} ${e.lastName}`;
      const discEmp = await DisciplineEmployee.findOne({ name: { $regex: new RegExp(`^${fullName}$`, 'i') } });
      return { _id: e._id, name: fullName, position: e.position, pin: e.pin, type: 'Employee', points: discEmp?.totalPoints || 0, terminated: discEmp?.terminated || false };
    }));

    const admList = await Promise.all(hourlyAdmins.map(async (a) => {
      const fullName = `${a.firstName} ${a.lastName || ''}`.trim();
      const discEmp = await DisciplineEmployee.findOne({ name: { $regex: new RegExp(`^${fullName}$`, 'i') } });
      return { _id: a._id, name: fullName, email: a.email, pin: a.pin || null, type: 'Admin', points: discEmp?.totalPoints || 0 };
    }));

    return res.json({ employees: empList, hourlyAdmins: admList });
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

// POST /timeclock/add-points - Add discipline points to an employee
router.post('/add-points', async (req, res) => {
  try {
    const { employeeName, points } = req.body;
    if (!employeeName || !points) return res.status(400).json({ message: 'employeeName and points required' });

    const pts = Math.min(Math.max(parseFloat(points) || 0, 0), 3);
    const emp = await DisciplineEmployee.findOne({ name: { $regex: new RegExp(`^${employeeName.trim()}$`, 'i') } });
    if (!emp) return res.status(404).json({ message: `${employeeName} not found in discipline roster` });

    const newTotal = Math.min(emp.totalPoints + pts, 3);
    emp.totalPoints = newTotal;
    if (newTotal >= 3) emp.terminated = true;
    await emp.save();

    return res.json({
      message: `${pts.toFixed(2)} point(s) added to ${employeeName}. New total: ${newTotal.toFixed(2)}/3.00${newTotal >= 3 ? ' — TERMINATION' : ''}`,
      newTotal
    });
  } catch (e) {
    console.error('Add points error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /timeclock/remove-employee/:id - Terminate/deactivate an employee
router.delete('/remove-employee/:id', async (req, res) => {
  try {
    const emp = await TimeClockEmployee.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    // Also mark as terminated in discipline roster
    const fullName = `${emp.firstName} ${emp.lastName}`;
    await DisciplineEmployee.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${fullName}$`, 'i') } },
      { terminated: true }
    );
    return res.json({ message: `${fullName} has been terminated and removed from time clock.` });
  } catch (e) {
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

// POST /timeclock/admin-self-punch - Hourly admin clocks themselves in/out (no PIN, IP required)
router.post('/admin-self-punch', verifyIp, async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ message: 'adminId required' });

    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const personName = `${admin.firstName} ${admin.lastName || ''}`;

    // Check for unacknowledged disciplines
    const pendingDisciplines = await Discipline.find({
      $or: [
        { linkedPersonId: admin._id, acknowledged: false },
        { employeeName: { $regex: new RegExp(`^${personName.trim()}$`, 'i') }, linkedPersonId: { $exists: false }, acknowledged: false }
      ]
    }).sort({ createdAt: -1 });

    const openEntry = await TimeClock.findOne({ employeeId: admin._id, clockOut: null });

    if (openEntry) {
      if (pendingDisciplines.length > 0) {
        return res.status(403).json({
          message: 'You must review and acknowledge your disciplinary action(s) before clocking out.',
          action: 'discipline_required',
          disciplines: pendingDisciplines,
          personId: admin._id,
          personName
        });
      }
      openEntry.clockOut = new Date();
      await openEntry.save();
      return res.json({ action: 'clocked_out', message: `${personName} clocked out.`, record: openEntry });
    } else {
      if (pendingDisciplines.length > 0) {
        return res.status(403).json({
          message: 'You must review and acknowledge your disciplinary action(s) before clocking in.',
          action: 'discipline_required',
          disciplines: pendingDisciplines,
          personId: admin._id,
          personName
        });
      }
      const entry = await TimeClock.create({
        employeeId: admin._id,
        employeeName: personName,
        clockIn: new Date(),
        ip: req.clientIp
      });
      return res.json({ action: 'clocked_in', message: `${personName} clocked in.`, record: entry });
    }
  } catch (e) {
    console.error('Admin self-punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/admin-self-acknowledge - Hourly admin acknowledges discipline (no PIN)
router.post('/admin-self-acknowledge', verifyIp, async (req, res) => {
  try {
    const { adminId, disciplineId, typedName, employeeStatement } = req.body;
    if (!adminId || !disciplineId || !typedName) {
      return res.status(400).json({ message: 'adminId, disciplineId, and typed name are required' });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(401).json({ message: 'Admin not found' });
    const personName = `${admin.firstName} ${admin.lastName || ''}`;

    if (typedName.trim().toLowerCase() !== personName.trim().toLowerCase()) {
      return res.status(400).json({ message: 'Typed name does not match your name on file.' });
    }

    const discipline = await Discipline.findById(disciplineId);
    if (!discipline) return res.status(404).json({ message: 'Discipline record not found' });

    discipline.acknowledged = true;
    discipline.acknowledgedAt = new Date();
    discipline.acknowledgedName = typedName.trim();
    if (employeeStatement) discipline.employeeStatement = employeeStatement;
    if (!discipline.linkedPersonId) {
      discipline.linkedPersonId = admin._id;
      discipline.linkedPersonType = 'Admin';
    }
    await discipline.save();

    // Send updated PDF with signatures to admins
    try {
      const pdfBuffer = await generateDisciplinePdf(discipline.toObject ? discipline.toObject() : discipline);
      const dateStr = discipline.incidentDate ? new Date(discipline.incidentDate).toLocaleDateString() : '';
      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: NOTIFY_EMAILS.join(','),
        subject: `ACKNOWLEDGED: ${discipline.employeeName} – Disciplinary Action ${dateStr}`,
        html: `<h2>Disciplinary Action Acknowledged</h2>
          <p><strong>Employee:</strong> ${discipline.employeeName}</p>
          <p><strong>Signed By:</strong> ${typedName.trim()}</p>
          <p><strong>Acknowledged At:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Supervisor:</strong> ${discipline.supervisorName || ''}</p>
          ${employeeStatement ? `<p><strong>Employee Statement:</strong> ${employeeStatement}</p>` : ''}
          <p>Updated PDF with employee signature attached.</p>`,
        attachments: [{
          filename: `Discipline_${discipline.employeeName.replace(/\s+/g, '_')}_SIGNED.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
    } catch (emailErr) {
      console.error('Discipline acknowledgment email failed:', emailErr);
    }

    const remaining = await Discipline.find({
      $or: [
        { linkedPersonId: admin._id, acknowledged: false },
        { employeeName: { $regex: new RegExp(`^${personName.trim()}$`, 'i') }, linkedPersonId: { $exists: false }, acknowledged: false }
      ]
    });

    return res.json({ message: 'Disciplinary action acknowledged.', remainingCount: remaining.length, remaining });
  } catch (e) {
    console.error('Admin self-acknowledge error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/admin-punch - Admin clocks in/out an employee by ID
router.post('/admin-punch', async (req, res) => {
  try {
    const { employeeId, purpose } = req.body;
    if (!employeeId) return res.status(400).json({ message: 'employeeId required' });

    // Find the person
    let personName;
    let person = await TimeClockEmployee.findById(employeeId);
    if (person) {
      personName = `${person.firstName} ${person.lastName}`;
    } else {
      const admin = await Admin.findById(employeeId);
      if (!admin) return res.status(404).json({ message: 'Employee not found' });
      personName = `${admin.firstName} ${admin.lastName || ''}`;
      person = admin;
    }

    const openEntry = await TimeClock.findOne({ employeeId: person._id, clockOut: null });

    if (openEntry) {
      const clockOutTime = new Date();
      openEntry.clockOut = clockOutTime;
      await openEntry.save();

      // Split if crosses Friday→Saturday midnight (Eastern time)
      const getEasternDay = (date) => {
        const eastern = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        return eastern.getDay();
      };
      const clockInTime = new Date(openEntry.clockIn);
      const clockInDayET = getEasternDay(clockInTime);
      const clockOutDayET = getEasternDay(clockOutTime);

      if (clockInDayET !== 6 && clockOutDayET === 6 && clockInTime.toDateString() !== clockOutTime.toDateString()) {
        const eastern = new Date(clockInTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const daysUntilSat = (6 - eastern.getDay() + 7) % 7 || 7;
        eastern.setDate(eastern.getDate() + daysUntilSat);
        eastern.setHours(0, 0, 0, 0);
        const satStr = `${eastern.getFullYear()}-${String(eastern.getMonth()+1).padStart(2,'0')}-${String(eastern.getDate()).padStart(2,'0')}T04:00:00.000Z`;
        const satMidnight = new Date(satStr);
        if (satMidnight > clockInTime && satMidnight < clockOutTime) {
          openEntry.clockOut = satMidnight;
          await openEntry.save();
          await TimeClock.create({
            employeeId: person._id,
            employeeName: personName,
            clockIn: satMidnight,
            clockOut: clockOutTime,
            purpose: openEntry.purpose || null,
            ip: 'admin-manual (split)'
          });
          return res.json({ action: 'clocked_out', message: `${personName} clocked out by admin. Shift split at pay period boundary.`, record: openEntry });
        }
      }

      return res.json({ action: 'clocked_out', message: `${personName} clocked out by admin.`, record: openEntry });
    } else {
      const entry = await TimeClock.create({
        employeeId: person._id,
        employeeName: personName,
        clockIn: new Date(),
        purpose: purpose || null,
        ip: 'admin-manual'
      });
      return res.json({ action: 'clocked_in', message: `${personName} clocked in by admin.`, record: entry });
    }
  } catch (e) {
    console.error('Admin punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/time-worked?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Total time worked per employee with punch times
router.get('/time-worked', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate required' });
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);

    const records = await TimeClock.find({
      clockIn: { $gte: start, $lt: end }
    }).sort({ clockIn: 1 });

    // Get all active employees so we can show those with 0 hours too
    const allEmployees = await TimeClockEmployee.find({ active: true }).select('firstName lastName position');
    const hourlyAdminEmails = ['tbsolutions77@gmail.com', 'tbsolutions14@gmail.com', 'tbsolutions66@gmail.com'];
    const hourlyAdmins = await Admin.find({ email: { $in: hourlyAdminEmails } }).select('firstName lastName email');

    // Build position map and initialize summary with all employees
    const positionMap = {};
    const summary = {};

    allEmployees.forEach(e => {
      const name = `${e.firstName} ${e.lastName}`;
      positionMap[name] = e.position;
      summary[name] = { totalMinutes: 0, days: {}, purpose: null };
    });

    hourlyAdmins.forEach(a => {
      const name = `${a.firstName} ${a.lastName || ''}`.trim();
      if (!summary[name]) {
        summary[name] = { totalMinutes: 0, days: {}, purpose: null };
        positionMap[name] = 'Foreman';
      }
    });

    // Fill in actual hours from records
    records.forEach(r => {
      const name = r.employeeName;
      if (!summary[name]) summary[name] = { totalMinutes: 0, days: {}, purpose: null };
      const clockOut = r.clockOut;
      const mins = clockOut ? Math.round((new Date(clockOut) - new Date(r.clockIn)) / 60000) : 0;
      const validMins = Math.max(mins, 0);
      summary[name].totalMinutes += validMins;
      if (r.purpose && !summary[name].purpose) summary[name].purpose = r.purpose;
      const dayKey = new Date(r.clockIn).toISOString().split('T')[0];
      if (!summary[name].days[dayKey]) summary[name].days[dayKey] = { minutes: 0, records: [] };
      summary[name].days[dayKey].minutes += validMins;
      summary[name].days[dayKey].records.push({
        _id: r._id,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        originalClockIn: r.originalClockIn || null,
        originalClockOut: r.originalClockOut || null,
        editedByAdmin: r.editedByAdmin || false,
        autoClockOut: r.autoClockOut || false,
        minutes: validMins,
        purpose: r.purpose || null
      });
    });

    const result = Object.entries(summary).map(([name, data]) => ({
      name,
      position: positionMap[name] || '',
      totalMinutes: data.totalMinutes,
      totalHours: (data.totalMinutes / 60).toFixed(2),
      days: data.days
    })).sort((a, b) => a.name.localeCompare(b.name));

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/manual-entry - Salary admin manually adds hours for an employee
router.post('/manual-entry', async (req, res) => {
  try {
    const { employeeId, date, clockIn, clockOut, reason, purpose } = req.body;
    if (!employeeId || !date || !clockIn || !clockOut) {
      return res.status(400).json({ message: 'employeeId, date, clockIn, clockOut are required' });
    }

    // Find the person
    let personName;
    let person = await TimeClockEmployee.findById(employeeId);
    if (person) {
      personName = `${person.firstName} ${person.lastName}`;
    } else {
      const admin = await Admin.findById(employeeId);
      if (!admin) return res.status(404).json({ message: 'Employee not found' });
      personName = `${admin.firstName} ${admin.lastName || ''}`;
      person = admin;
    }

    // Parse clock in/out times for the given date
    const clockInDate = new Date(`${date}T${clockIn}:00`);
    const clockOutDate = new Date(`${date}T${clockOut}:00`);

    if (clockOutDate <= clockInDate) {
      return res.status(400).json({ message: 'Clock out must be after clock in' });
    }

    const entry = await TimeClock.create({
      employeeId: person._id,
      employeeName: personName,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      purpose: purpose || null,
      ip: `admin-manual${reason ? ': ' + reason : ''}`
    });

    const mins = Math.round((clockOutDate - clockInDate) / 60000);
    return res.json({
      message: `${personName}: ${(mins/60).toFixed(2)} hrs added for ${date}`,
      record: entry
    });
  } catch (e) {
    console.error('Manual entry error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/deduct-time - Salary admin deducts time from an employee's record
router.post('/deduct-time', async (req, res) => {
  try {
    const { employeeId, date, minutes, reason } = req.body;
    if (!employeeId || !date || !minutes) {
      return res.status(400).json({ message: 'employeeId, date, and minutes are required' });
    }

    const mins = parseInt(minutes);
    if (mins <= 0) return res.status(400).json({ message: 'Minutes must be greater than 0' });

    // Find the person
    let personName;
    let person = await TimeClockEmployee.findById(employeeId);
    if (person) {
      personName = `${person.firstName} ${person.lastName}`;
    } else {
      const admin = await Admin.findById(employeeId);
      if (!admin) return res.status(404).json({ message: 'Employee not found' });
      personName = `${admin.firstName} ${admin.lastName || ''}`;
      person = admin;
    }

    // Create a negative time entry (deduction)
    const deductDate = new Date(`${date}T12:00:00`);
    const entry = await TimeClock.create({
      employeeId: person._id,
      employeeName: personName,
      clockIn: deductDate,
      clockOut: new Date(deductDate.getTime() - mins * 60000),
      ip: `admin-deduction${reason ? ': ' + reason : ''}`
    });

    return res.json({
      message: `${mins} min deducted from ${personName} on ${date}${reason ? ' (' + reason + ')' : ''}`,
      record: entry
    });
  } catch (e) {
    console.error('Deduct time error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/my-week?pin=XXXX - Employee sees their current week hours (Sat-Fri)
router.get('/my-week', async (req, res) => {
  try {
    const { pin } = req.query;
    if (!pin) return res.status(400).json({ message: 'PIN required' });

    const person = await findPersonByPin(pin);
    if (!person) return res.status(401).json({ message: 'Invalid PIN' });

    // Calculate current week Saturday-Friday
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - ((dayOfWeek + 1) % 7));
    saturday.setHours(0, 0, 0, 0);
    const friday = new Date(saturday);
    friday.setDate(saturday.getDate() + 7);

    const records = await TimeClock.find({
      employeeId: person.id,
      clockIn: { $gte: saturday, $lt: friday }
    }).sort({ clockIn: 1 });

    let totalMinutes = 0;
    const days = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    records.forEach(r => {
      const clockOut = r.clockOut || new Date();
      const mins = Math.round((new Date(clockOut) - new Date(r.clockIn)) / 60000);
      totalMinutes += mins;
      const dayIdx = new Date(r.clockIn).getDay();
      const dayName = dayNames[dayIdx];
      if (!days[dayName]) days[dayName] = { minutes: 0, records: [] };
      days[dayName].minutes += mins;
      days[dayName].records.push({
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        minutes: mins,
        purpose: r.purpose || null
      });
    });

    return res.json({
      name: person.name,
      weekStart: saturday.toISOString().split('T')[0],
      weekEnd: new Date(friday.getTime() - 86400000).toISOString().split('T')[0],
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
      days
    });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/punch-offline - Process a queued offline punch
router.post('/punch-offline', async (req, res) => {
  try {
    const { pin, purpose, timestamp } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN is required' });

    const person = await findPersonByPin(pin);
    if (!person) return res.status(401).json({ message: 'Invalid PIN' });

    const punchTime = timestamp ? new Date(timestamp) : new Date();

    // Check if this punch was already processed (dedup by time window)
    const windowStart = new Date(punchTime.getTime() - 60000); // 1 min window
    const windowEnd = new Date(punchTime.getTime() + 60000);
    const duplicate = await TimeClock.findOne({
      employeeId: person.id,
      clockIn: { $gte: windowStart, $lte: windowEnd }
    });
    if (duplicate) return res.status(409).json({ message: 'Already processed' });

    const openEntry = await TimeClock.findOne({ employeeId: person.id, clockOut: null });

    if (openEntry) {
      openEntry.clockOut = punchTime;
      await openEntry.save();
      return res.json({ action: 'clocked_out', message: `${person.name} clocked out (synced).` });
    } else {
      await TimeClock.create({
        employeeId: person.id,
        employeeName: person.name,
        clockIn: punchTime,
        purpose: purpose || null,
        ip: 'offline-sync'
      });
      return res.json({ action: 'clocked_in', message: `${person.name} clocked in (synced).` });
    }
  } catch (e) {
    console.error('Offline punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /timeclock/check-ip
router.get('/check-ip', (req, res) => {
  const clientIp = getClientIp(req);
  const allowed = ALLOWED_IPS.some(ip => clientIp === ip) ||
    (IPV6_PREFIX && clientIp.startsWith(IPV6_PREFIX));
  return res.json({ allowed, ip: clientIp });
});

// GET /timeclock/clockout-check/:employeeId - Check if employee needs to fill out a work order before clocking out
router.get('/clockout-check/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Find the open clock entry to get the purpose
    const openEntry = await TimeClock.findOne({ employeeId, clockOut: null });
    if (!openEntry) return res.json({ allowed: true });

    const purpose = (openEntry.purpose || '').trim();
    // Use the clock-IN date for the work order check (handles night/graveyard shifts)
    const clockInDate = new Date(openEntry.clockIn);
    const clockInDay = `${clockInDate.getFullYear()}-${String(clockInDate.getMonth()+1).padStart(2,'0')}-${String(clockInDate.getDate()).padStart(2,'0')}`;

    // Determine employee name and position
    let empName = openEntry.employeeName || '';
    let position = '';
    const emp = await TimeClockEmployee.findById(employeeId);
    if (emp) {
      position = emp.position;
      empName = `${emp.firstName} ${emp.lastName}`;
    } else {
      const admin = await Admin.findById(employeeId);
      if (admin) {
        empName = `${admin.firstName} ${admin.lastName || ''}`.trim();
        position = 'Foreman';
      }
    }

    console.log(`[clockout-check] Employee: ${empName}, Position: ${position}, Purpose: ${purpose}, ClockIn: ${clockInDate.toISOString()}, CheckDate: ${clockInDay}`);

    // Count how many completed clock sessions this employee has TODAY that match the same purpose
    // Each session needs its own work order
    const dayStart = new Date(clockInDay + 'T00:00:00');
    const dayEnd = new Date(clockInDay + 'T23:59:59');

    // Check 1: Standby and Shop Work require a shop work order per session
    if (purpose === 'Standby' || purpose === 'Shop Work') {
      // Count completed sessions with same purpose on the clock-in day
      const completedSessions = await TimeClock.countDocuments({
        employeeId,
        purpose: { $in: ['Shop Work', 'Standby'] },
        clockIn: { $gte: dayStart, $lte: dayEnd },
        clockOut: { $ne: null }
      });
      // Count shop work orders for this employee on that day
      const shopWoCount = await ShopWorkOrder.countDocuments({
        date: clockInDay,
        employeeNames: { $regex: new RegExp(empName.trim(), 'i') }
      });
      // Current open session means they need (completedSessions + 1) work orders total
      const needed = completedSessions + 1;
      console.log(`[clockout-check] Shop/Standby sessions: ${completedSessions} completed + 1 current = ${needed} needed, found ${shopWoCount} shop WOs`);
      if (shopWoCount < needed) {
        return res.json({
          allowed: false,
          reason: 'shop_work_order_required',
          message: `You must complete a Shop Work Order for this session before clocking out. (${shopWoCount}/${needed} filled)`,
          employeeName: empName
        });
      }
    }

    // Check 2: Foreman/Driver (non-Shop Work/Standby) requires a regular work order per session
    if ((position === 'Foreman' || position === 'Driver') && purpose !== 'Shop Work' && purpose !== 'Standby') {
      // Count completed TC sessions on the clock-in day
      const completedSessions = await TimeClock.countDocuments({
        employeeId,
        purpose: { $nin: ['Shop Work', 'Standby', null, ''] },
        clockIn: { $gte: dayStart, $lte: dayEnd },
        clockOut: { $ne: null }
      });
      // Count work orders for this employee on that day
      const woCount = await WorkOrder.countDocuments({
        scheduledDate: { $gte: dayStart, $lte: dayEnd },
        $or: [
          { 'basic.foremanName': { $regex: new RegExp(empName.trim(), 'i') } },
          { 'tbs.flagger1': { $regex: new RegExp(empName.trim(), 'i') } },
          { 'tbs.flagger2': { $regex: new RegExp(empName.trim(), 'i') } },
          { 'tbs.flagger3': { $regex: new RegExp(empName.trim(), 'i') } },
          { 'tbs.flagger4': { $regex: new RegExp(empName.trim(), 'i') } },
          { 'tbs.flagger5': { $regex: new RegExp(empName.trim(), 'i') } },
        ]
      });
      const needed = completedSessions + 1;
      console.log(`[clockout-check] TC sessions: ${completedSessions} completed + 1 current = ${needed} needed, found ${woCount} work orders`);
      if (woCount < needed) {
        return res.json({
          allowed: false,
          reason: 'work_order_required',
          message: `You must complete a Work Order for this session before clocking out. (${woCount}/${needed} filled)`,
          employeeName: empName
        });
      }
    }

    return res.json({ allowed: true });
  } catch (e) {
    console.error('Clockout check error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /timeclock/delete-punch/:id - Admin deletes a punch record
router.delete('/delete-punch/:id', async (req, res) => {
  try {
    const record = await TimeClock.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    return res.json({ message: `Deleted punch for ${record.employeeName}` });
  } catch (e) {
    console.error('Delete punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /timeclock/edit-punch/:id - Admin edits clock in/out times on a record
router.put('/edit-punch/:id', async (req, res) => {
  try {
    const { clockIn, clockOut } = req.body;
    if (!clockIn && !clockOut) return res.status(400).json({ message: 'clockIn or clockOut required' });

    const record = await TimeClock.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Store originals if not already stored
    if (!record.originalClockIn) record.originalClockIn = record.clockIn;
    if (!record.originalClockOut && record.clockOut) record.originalClockOut = record.clockOut;

    // Get the calendar date in Eastern from the original clock-in
    const baseDate = record.originalClockIn || record.clockIn;
    const etDateStr = baseDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD

    // Helper: convert "HH:MM" on a given ET date to a UTC Date object
    const etTimeToUTC = (dateYMD, timeHHMM) => {
      const [h, m] = timeHHMM.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      // Create a reference date at noon UTC on that day to determine DST
      const refDate = new Date(dateYMD + 'T12:00:00Z');
      const refET = new Date(refDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const offsetHours = (refDate.getTime() - refET.getTime()) / (1000 * 60 * 60);
      // offsetHours will be negative (-4 for EDT, -5 for EST)
      // To convert ET to UTC: subtract the offset (i.e., add the absolute value)
      const absOffset = Math.abs(offsetHours);
      // Build UTC date: the ET time + offset = UTC time
      const utcMs = new Date(dateYMD + 'T00:00:00Z').getTime() + (h * 60 + m) * 60000 + absOffset * 3600000;
      return new Date(utcMs);
    };

    if (clockIn) {
      const time = clockIn.includes('T') ? clockIn.split('T')[1].substring(0, 5) : clockIn;
      const newClockIn = etTimeToUTC(etDateStr, time);
      if (!newClockIn || isNaN(newClockIn.getTime())) return res.status(400).json({ message: 'Invalid clockIn time. Use HH:MM format.' });
      record.clockIn = newClockIn;
    }
    if (clockOut) {
      const time = clockOut.includes('T') ? clockOut.split('T')[1].substring(0, 5) : clockOut;
      // Check if overnight (clockOut hour < clockIn hour means next day)
      let outDateStr = etDateStr;
      const inTimeStr = clockIn ? (clockIn.includes('T') ? clockIn.split('T')[1].substring(0,5) : clockIn) : null;
      if (inTimeStr && time < inTimeStr) {
        const nextDay = new Date(etDateStr + 'T12:00:00Z');
        nextDay.setDate(nextDay.getDate() + 1);
        outDateStr = nextDay.toISOString().split('T')[0];
      }
      const newClockOut = etTimeToUTC(outDateStr, time);
      if (!newClockOut || isNaN(newClockOut.getTime())) return res.status(400).json({ message: 'Invalid clockOut time. Use HH:MM format.' });
      record.clockOut = newClockOut;
    }
    record.editedByAdmin = true;
    await record.save();

    const mins = record.clockOut ? Math.round((new Date(record.clockOut) - new Date(record.clockIn)) / 60000) : 0;
    return res.json({ message: `Updated ${record.employeeName}: ${(mins/60).toFixed(2)} hrs`, record });
  } catch (e) {
    console.error('Edit punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /timeclock/edit-purpose/:id - Admin edits the purpose of a clock-in record
router.put('/edit-purpose/:id', async (req, res) => {
  try {
    const { purpose } = req.body;
    if (!purpose) return res.status(400).json({ message: 'purpose is required' });
    const record = await TimeClock.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    record.purpose = purpose;
    await record.save();
    return res.json({ message: `Purpose updated to "${purpose}" for ${record.employeeName}`, record });
  } catch (e) {
    console.error('Edit purpose error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /timeclock/add-punch - Admin adds a new punch line for an employee on a specific day
router.post('/add-punch', async (req, res) => {
  try {
    const { employeeId, date, clockIn, clockOut, purpose } = req.body;
    if (!employeeId || !date || !clockIn || !clockOut) {
      return res.status(400).json({ message: 'employeeId, date, clockIn, clockOut required' });
    }

    let personName;
    let person = await TimeClockEmployee.findById(employeeId);
    if (person) {
      personName = `${person.firstName} ${person.lastName}`;
    } else {
      const admin = await Admin.findById(employeeId);
      if (!admin) return res.status(404).json({ message: 'Employee not found' });
      personName = `${admin.firstName} ${admin.lastName || ''}`;
      person = admin;
    }

    const clockInDate = new Date(`${date}T${clockIn}:00`);
    const clockOutDate = new Date(`${date}T${clockOut}:00`);
    if (clockOutDate <= clockInDate) return res.status(400).json({ message: 'Clock out must be after clock in' });

    const entry = await TimeClock.create({
      employeeId: person._id,
      employeeName: personName,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      purpose: purpose || null,
      ip: 'admin-added',
      editedByAdmin: true
    });

    const mins = Math.round((clockOutDate - clockInDate) / 60000);
    return res.json({ message: `Added ${(mins/60).toFixed(2)} hrs for ${personName}`, record: entry });
  } catch (e) {
    console.error('Add punch error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

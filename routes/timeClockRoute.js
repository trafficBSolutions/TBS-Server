const express = require('express');
const router = express.Router();
const TimeClock = require('../models/timeClock');
const TimeClockEmployee = require('../models/timeClockEmployee');
const DisciplineEmployee = require('../models/disciplineEmployee');
const Admin = require('../models/Admin');
const Discipline = require('../models/discipline');
const { transporter } = require('../utils/emailConfig');
const { generateDisciplinePdf } = require('../services/disciplinePDF');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com'];

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
    const { employeeId } = req.body;
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
      openEntry.clockOut = new Date();
      await openEntry.save();
      return res.json({ action: 'clocked_out', message: `${personName} clocked out by admin.`, record: openEntry });
    } else {
      const entry = await TimeClock.create({
        employeeId: person._id,
        employeeName: personName,
        clockIn: new Date(),
        ip: 'admin-manual'
      });
      return res.json({ action: 'clocked_in', message: `${personName} clocked in by admin.`, record: entry });
    }
  } catch (e) {
    console.error('Admin punch error:', e);
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

const Discipline = require('../models/discipline');
const DisciplineEmployee = require('../models/disciplineEmployee');
const { transporter } = require('../utils/emailConfig');
const { generateDisciplinePdf } = require('../services/disciplinePDF');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com'];

// ── Employee Roster CRUD ──

const addEmployee = async (req, res) => {
  try {
    const { name, position, totalPoints } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const pts = Math.min(Math.max(parseFloat(totalPoints) || 0, 0), 3);
    const doc = await DisciplineEmployee.create({ name: name.trim(), position: position?.trim() || '', totalPoints: pts, terminated: pts >= 3 });
    res.status(201).json(doc);
  } catch (e) {
    console.error('addEmployee:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const listEmployees = async (req, res) => {
  try {
    const employees = await DisciplineEmployee.find().sort({ name: 1 });
    res.json(employees);
  } catch (e) {
    console.error('listEmployees:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    await DisciplineEmployee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('deleteEmployee:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeePoints = async (req, res) => {
  try {
    const emp = await DisciplineEmployee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const history = await Discipline.find({ employeeRef: emp._id }).sort({ createdAt: -1 });
    res.json({ employee: emp, history });
  } catch (e) {
    console.error('getEmployeePoints:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Discipline Submit ──

const submitDiscipline = async (req, res) => {
  try {
    const { employeeName, supervisorName, incidentDate, employeeRef, points } = req.body;
    if (!employeeName || !supervisorName || !incidentDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pointsNum = Math.min(Math.max(parseFloat(points) || 0, 0), 3);

    let previousPoints = 0;
    let emp = null;
    if (employeeRef) {
      emp = await DisciplineEmployee.findById(employeeRef);
      if (emp) previousPoints = emp.totalPoints;
    }

    const newTotal = Math.min(previousPoints + pointsNum, 3);

    const doc = await Discipline.create({
      ...req.body,
      points: pointsNum,
      previousPoints,
      newTotalPoints: newTotal
    });

    // Update employee total points
    if (emp) {
      emp.totalPoints = newTotal;
      if (newTotal >= 3) emp.terminated = true;
      await emp.save();
    }

    // Email with PDF
    try {
      const pdfBuffer = await generateDisciplinePdf(doc.toObject());
      const dateStr = doc.incidentDate ? new Date(doc.incidentDate).toLocaleDateString() : '';
      const termNotice = newTotal >= 3 ? '<p style="color:red;font-weight:bold">⚠️ EMPLOYEE HAS REACHED 3.00 POINTS — TERMINATION REQUIRED</p>' : '';
      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: NOTIFY_EMAILS.join(','),
        subject: `DISCIPLINARY ACTION: ${doc.employeeName} – ${dateStr}${newTotal >= 3 ? ' [TERMINATION]' : ''}`,
        html: `<h2>Disciplinary Action Filed</h2>
          <p><strong>Employee:</strong> ${doc.employeeName}</p>
          <p><strong>Incident Date:</strong> ${dateStr}</p>
          <p><strong>Violation:</strong> ${(doc.violationTypes || []).join(', ')}</p>
          <p><strong>Points Added:</strong> ${pointsNum.toFixed(2)}</p>
          <p><strong>Previous Points:</strong> ${previousPoints.toFixed(2)}</p>
          <p><strong>New Total:</strong> ${newTotal.toFixed(2)} / 3.00</p>
          ${termNotice}
          <p>See attached PDF. Print and obtain signatures in the office.</p>`,
        attachments: [{
          filename: `Discipline_${doc.employeeName.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
    } catch (emailErr) {
      console.error('Discipline email failed:', emailErr);
    }

    res.status(201).json(doc);
  } catch (e) {
    console.error('submitDiscipline error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── List / PDF ──

const listByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year required' });
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const items = await Discipline.find({ incidentDate: { $gte: start, $lt: end } }).sort({ incidentDate: 1 });
    const grouped = {};
    items.forEach(d => {
      const key = d.incidentDate.toISOString().split('T')[0];
      (grouped[key] ||= []).push(d);
    });
    res.json(grouped);
  } catch (e) {
    console.error('listByMonth:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const listByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + 1));
    const items = await Discipline.find({ incidentDate: { $gte: start, $lt: end } }).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    console.error('listByDate:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDisciplinePDF = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return res.status(400).json({ error: 'Invalid ID' });
    const doc = await Discipline.findById(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const buf = await generateDisciplinePdf(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Discipline_${doc.employeeName.replace(/\s+/g, '_')}.pdf"`);
    res.send(buf);
  } catch (e) {
    console.error('getDisciplinePDF:', e);
    res.status(500).json({ error: 'PDF generation failed' });
  }
};

module.exports = {
  addEmployee, listEmployees, deleteEmployee, getEmployeePoints,
  submitDiscipline, listByMonth, listByDate, getDisciplinePDF
};

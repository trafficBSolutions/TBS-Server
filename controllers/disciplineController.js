const Discipline = require('../models/discipline');
const { transporter } = require('../utils/emailConfig');
const { generateDisciplinePdf } = require('../services/disciplinePDF');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com'];

const submitDiscipline = async (req, res) => {
  try {
    const { employeeName, issuedByName, supervisorName, incidentDate } = req.body;
    if (!employeeName || !issuedByName || !supervisorName || !incidentDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const doc = await Discipline.create(req.body);

    try {
      const pdfBuffer = await generateDisciplinePdf(doc);
      const dateStr = doc.incidentDate ? new Date(doc.incidentDate).toLocaleDateString() : '';
      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: NOTIFY_EMAILS.join(','),
        subject: `DISCIPLINARY ACTION: ${doc.employeeName} – ${dateStr}`,
        html: `<h2>Disciplinary Action Filed</h2>
          <p><strong>Employee:</strong> ${doc.employeeName}</p>
          <p><strong>Incident Date:</strong> ${dateStr}</p>
          <p><strong>Violation:</strong> ${(doc.violationTypes || []).join(', ')}</p>
          <p><strong>Issued By:</strong> ${doc.issuedByName}</p>
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

module.exports = { submitDiscipline, listByMonth, listByDate, getDisciplinePDF };

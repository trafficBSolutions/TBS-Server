// controllers/disciplineControl.js
const DisciplinaryAction = require('../models/discipline');
const { generateDisciplinePdfBuffer } = require('../services/disciplinePDF');

function ymd(d) { return new Date(d).toISOString().slice(0,10); }

exports.createAction = async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await DisciplinaryAction.create({
      ...body,
      createdBy: req.user?.email || undefined
    });
    res.status(201).json(doc);
  } catch (e) {
    console.error('createAction error:', e);
    res.status(400).json({ message: 'Invalid submission', error: String(e) });
  }
};

exports.getActionsByDay = async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.json([]);
    const start = new Date(date + 'T00:00:00.000Z');
    const end   = new Date(date + 'T23:59:59.999Z');
    const items = await DisciplinaryAction.find({ incidentDate: { $gte: start, $lte: end } })
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch daily disciplinary actions' });
  }
};

exports.getActionsByMonth = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year  = parseInt(req.query.year, 10);
    if (!month || !year) return res.json([]);

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59)); // end of month
    const items = await DisciplinaryAction.find({ incidentDate: { $gte: start, $lte: end } })
      .sort({ incidentDate: 1 });

    // group as { "YYYY-MM-DD": [...] }
    const grouped = {};
    for (const d of items) {
      const key = ymd(d.incidentDate);
      (grouped[key] ||= []).push(d);
    }
    res.json(grouped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch monthly disciplinary actions' });
  }
};

exports.getActionById = async (req, res) => {
  try {
    const doc = await DisciplinaryAction.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch disciplinary action' });
  }
};

exports.streamPdf = async (req, res) => {
  try {
    const doc = await DisciplinaryAction.findById(req.params.id);
    if (!doc) return res.status(404).send('Not found');

    const pdfBuffer = await generateDisciplinePdfBuffer(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="DisciplinaryAction_${doc._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF error:', e);
    res.status(500).send('Failed to generate PDF');
  }
};

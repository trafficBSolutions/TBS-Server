const SafetyMeeting = require('../models/safetyMeeting');
const JobInspection = require('../models/jobInspection');
const { generateSafetyMeetingPdf } = require('../services/safetyMeetingPDF');
const { generateJobInspectionPdf } = require('../services/jobInspectionPDF');
const { transporter } = require('../utils/emailConfig');

const NOTIFY_EMAILS = ['tbsolutions9@gmail.com', 'tbsolutions4@gmail.com', 'materialworx2@gmail.com'];

// ── Safety Meetings ──

const submitSafetyMeeting = async (req, res) => {
  try {
    const doc = await SafetyMeeting.create(req.body);
    try {
      const pdf = await generateSafetyMeetingPdf(doc.toObject());
      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: NOTIFY_EMAILS.join(','),
        subject: `Safety Meeting — ${doc.jobsite} — ${new Date(doc.meetingDate).toLocaleDateString()}`,
        html: `<h2>Safety Meeting Filed</h2>
          <p><strong>Jobsite:</strong> ${doc.jobsite}</p>
          <p><strong>Date:</strong> ${new Date(doc.meetingDate).toLocaleDateString()}</p>
          <p><strong>Leader:</strong> ${doc.meetingLeader}</p>
          <p><strong>Topic:</strong> ${doc.toolboxTopic}</p>
          <p><strong>Attendees:</strong> ${doc.attendees?.length || 0}</p>
          <p><strong>Hazards:</strong> ${doc.hazards?.length || 0}</p>`,
        attachments: [{ filename: `SafetyMeeting_${doc.jobsite.replace(/\s+/g, '_')}.pdf`, content: pdf, contentType: 'application/pdf' }]
      });
    } catch (emailErr) { console.error('Safety meeting email failed:', emailErr); }
    res.status(201).json(doc);
  } catch (e) {
    console.error('submitSafetyMeeting:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const listSafetyMeetingsByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year required' });
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const items = await SafetyMeeting.find({ meetingDate: { $gte: start, $lt: end } }).sort({ meetingDate: 1 });
    const grouped = {};
    items.forEach(d => { const key = new Date(d.meetingDate).toISOString().split('T')[0]; (grouped[key] ||= []).push(d); });
    res.json(grouped);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

const listSafetyMeetingsByDay = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + 1));
    const items = await SafetyMeeting.find({ meetingDate: { $gte: start, $lt: end } }).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

const getSafetyMeetingPDF = async (req, res) => {
  try {
    const doc = await SafetyMeeting.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const buf = await generateSafetyMeetingPdf(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SafetyMeeting_${doc.jobsite.replace(/\s+/g, '_')}.pdf"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: 'PDF generation failed' }); }
};

// ── Job Inspections ──

const submitJobInspection = async (req, res) => {
  try {
    const doc = await JobInspection.create(req.body);
    try {
      const pdf = await generateJobInspectionPdf(doc.toObject());
      const isStopped = doc.result === 'WorkStopped';
      await transporter.sendMail({
        from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
        to: NOTIFY_EMAILS.join(','),
        subject: `${isStopped ? '⛔ WORK STOPPED — ' : ''}Daily Inspection — ${doc.jobsite} — ${new Date(doc.inspectionDate).toLocaleDateString()}`,
        html: `<h2>Daily Jobsite Inspection Filed</h2>
          <p><strong>Jobsite:</strong> ${doc.jobsite}</p>
          <p><strong>Date:</strong> ${new Date(doc.inspectionDate).toLocaleDateString()}</p>
          <p><strong>Inspector:</strong> ${doc.inspector}</p>
          <p><strong>Result:</strong> <span style="color:${isStopped ? 'red' : doc.result === 'Pass' ? 'green' : 'orange'};font-weight:bold">${doc.result}</span></p>
          ${isStopped ? `<p style="color:red;font-weight:bold">⛔ WORK STOPPED: ${doc.stopWorkReason || ''}</p>` : ''}
          <p><strong>Deficiencies:</strong> ${(doc.items || []).filter(i => i.status === 'Deficiency').length}</p>`,
        attachments: [{ filename: `Inspection_${doc.jobsite.replace(/\s+/g, '_')}.pdf`, content: pdf, contentType: 'application/pdf' }]
      });
    } catch (emailErr) { console.error('Inspection email failed:', emailErr); }
    res.status(201).json(doc);
  } catch (e) {
    console.error('submitJobInspection:', e);
    res.status(500).json({ error: 'Server error' });
  }
};

const listJobInspectionsByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year required' });
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const items = await JobInspection.find({ inspectionDate: { $gte: start, $lt: end } }).sort({ inspectionDate: 1 });
    const grouped = {};
    items.forEach(d => { const key = new Date(d.inspectionDate).toISOString().split('T')[0]; (grouped[key] ||= []).push(d); });
    res.json(grouped);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

const listJobInspectionsByDay = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + 1));
    const items = await JobInspection.find({ inspectionDate: { $gte: start, $lt: end } }).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
};

const getJobInspectionPDF = async (req, res) => {
  try {
    const doc = await JobInspection.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const buf = await generateJobInspectionPdf(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Inspection_${doc.jobsite.replace(/\s+/g, '_')}.pdf"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: 'PDF generation failed' }); }
};

module.exports = {
  submitSafetyMeeting, listSafetyMeetingsByMonth, listSafetyMeetingsByDay, getSafetyMeetingPDF,
  submitJobInspection, listJobInspectionsByMonth, listJobInspectionsByDay, getJobInspectionPDF
};

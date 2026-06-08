const LeaveRequest = require('../models/leaveRequest');
const { transporter } = require('../utils/emailConfig');
const path = require('path');

const NOTIFY_EMAILS = [
  { name: 'William Rowell', address: 'tbsolutions1999@gmail.com' },
  { name: 'Leah Davis', address: 'trafficandbarriersolutions.ap@gmail.com' },
  { name: 'Bryson Davis', address: 'tbsolutions9@gmail.com' },
  { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
  { name: 'Debbie Owens', address: 'tbsolutions.work.orders@gmail.com' },
];

const APPROVERS = new Set([
  'tbsolutions1999@gmail.com',
  'trafficandbarriersolutions.ap@gmail.com',
  'tbsolutions9@gmail.com',
  'tbsolutions4@gmail.com',
  'tbsolutions.work.orders@gmail.com',
]);

const APP_URL = process.env.APP_URL || 'https://www.trafficbarriersolutions.com';
const API_URL = process.env.API_BASE_URL || 'https://tbs-server.onrender.com';

// POST /leave-request
const submitLeaveRequest = async (req, res) => {
  try {
    const { employeeName, position, department, supervisor, leaveType, otherLeaveType, startDate, endDate, totalDays, reason, signatureName, signatureBase64 } = req.body;

    const required = ['employeeName', 'position', 'supervisor', 'leaveType', 'startDate', 'endDate', 'totalDays', 'reason', 'signatureName', 'signatureBase64'];
    const missing = required.filter(f => !req.body[f] || !String(req.body[f]).trim());
    if (missing.length) return res.status(400).json({ error: 'Missing required fields', missing });

    const doc = await LeaveRequest.create({
      employeeName, position, department, supervisor, leaveType, otherLeaveType,
      startDate, endDate, totalDays: Number(totalDays), reason, signatureName, signatureBase64
    });

    // Send notification email
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a1a2e;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;">Leave Request Submitted</h1>
      </div>
      <div style="padding:20px;background:#f9f9f9;border:1px solid #ddd;border-radius:0 0 8px 8px;">
        <p>A new leave request has been submitted and requires approval.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Employee:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${doc.employeeName}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Position:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${doc.position}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Supervisor:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${doc.supervisor}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Leave Type:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${doc.leaveType}${doc.otherLeaveType ? ' - ' + doc.otherLeaveType : ''}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Dates:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${doc.startDate} to ${doc.endDate}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Total Days:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${doc.totalDays}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Reason:</td><td style="padding:8px;">${doc.reason}</td></tr>
        </table>
        <p style="margin-top:15px;font-size:12px;color:#666;">Please approve or deny this request from the Admin Dashboard.</p>
      </div>
    </div>`;

    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS[0].address,
      bcc: NOTIFY_EMAILS.slice(1).map(e => e.address),
      subject: `LEAVE REQUEST: ${doc.employeeName} – ${doc.leaveType} – ${doc.startDate} to ${doc.endDate}`,
      html,
      attachments: [{
        filename: 'signature.png',
        cid: 'signatureImage',
        content: Buffer.from(doc.signatureBase64, 'base64'),
        contentType: 'image/png',
        contentDisposition: 'inline'
      }]
    }, (err) => { if (err) console.error('Leave request email error:', err); });

    res.status(201).json({ message: 'Leave request submitted successfully', id: doc._id });
  } catch (e) {
    console.error('Leave request submission error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// GET /leave-requests
const listLeaveRequests = async (req, res) => {
  try {
    const { status, month, year } = req.query;
    let query = {};
    if (status) query.status = status;
    if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      const regex = new RegExp(`^${year}-${monthStr}`);
      query.startDate = { $regex: regex };
    }
    const items = await LeaveRequest.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /leave-requests/pending
const getPendingLeaveRequests = async (req, res) => {
  try {
    const items = await LeaveRequest.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /leave-requests/:id/approve
const approveLeaveRequest = async (req, res) => {
  try {
    const { approverName } = req.body;
    if (!approverName) return res.status(400).json({ error: 'Approver name is required' });

    const doc = await LeaveRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'pending') return res.status(400).json({ error: `Already ${doc.status}` });

    doc.status = 'approved';
    doc.approvedBy = approverName;
    doc.approvedAt = new Date();
    await doc.save();

    // Notify all
    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS.map(e => e.address),
      subject: `✅ APPROVED – Leave Request – ${doc.employeeName} – ${doc.startDate} to ${doc.endDate}`,
      html: `<div style="font-family:Arial;padding:20px;"><h2 style="color:#4CAF50;">✅ Leave Request Approved</h2><p><strong>Employee:</strong> ${doc.employeeName}</p><p><strong>Leave Type:</strong> ${doc.leaveType}</p><p><strong>Dates:</strong> ${doc.startDate} to ${doc.endDate} (${doc.totalDays} days)</p><p><strong>Approved by:</strong> ${approverName}</p></div>`,
    }, () => {});

    res.json({ message: 'Leave request approved', doc });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /leave-requests/:id/deny
const denyLeaveRequest = async (req, res) => {
  try {
    const { denierName, reason } = req.body;
    if (!denierName) return res.status(400).json({ error: 'Denier name is required' });

    const doc = await LeaveRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'pending') return res.status(400).json({ error: `Already ${doc.status}` });

    doc.status = 'denied';
    doc.deniedBy = denierName;
    doc.deniedAt = new Date();
    doc.denialReason = reason || '';
    await doc.save();

    transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: NOTIFY_EMAILS.map(e => e.address),
      subject: `❌ DENIED – Leave Request – ${doc.employeeName} – ${doc.startDate} to ${doc.endDate}`,
      html: `<div style="font-family:Arial;padding:20px;"><h2 style="color:#f44336;">❌ Leave Request Denied</h2><p><strong>Employee:</strong> ${doc.employeeName}</p><p><strong>Leave Type:</strong> ${doc.leaveType}</p><p><strong>Dates:</strong> ${doc.startDate} to ${doc.endDate}</p><p><strong>Denied by:</strong> ${denierName}</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}</div>`,
    }, () => {});

    res.json({ message: 'Leave request denied', doc });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { submitLeaveRequest, listLeaveRequests, getPendingLeaveRequests, approveLeaveRequest, denyLeaveRequest };

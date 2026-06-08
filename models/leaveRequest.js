const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
  employeeName: { type: String, required: true },
  position: { type: String, required: true },
  department: { type: String, default: '' },
  supervisor: { type: String, required: true },
  leaveType: { type: String, enum: ['Vacation', 'Sick', 'Personal', 'Bereavement', 'Unpaid', 'Other'], required: true },
  otherLeaveType: { type: String, default: '' },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  totalDays: { type: Number, required: true },
  reason: { type: String, required: true },
  signatureName: { type: String, required: true },
  signatureBase64: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  deniedBy: { type: String, default: '' },
  deniedAt: { type: Date },
  denialReason: { type: String, default: '' },
}, { timestamps: true });

LeaveRequestSchema.index({ startDate: 1 });
LeaveRequestSchema.index({ status: 1 });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);

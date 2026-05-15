const mongoose = require('mongoose');

const TimeClockSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  clockIn: { type: Date, required: true },
  clockOut: { type: Date, default: null },
  ip: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('TimeClock', TimeClockSchema);

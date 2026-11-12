const mongoose = require('mongoose');

const ScheduledEmployeeSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeClockEmployee', required: true },
  employeeName: { type: String, required: true },
  clockInTime: { type: String, required: true }, // "HH:MM" 24h
  purpose: { type: String, required: true },
});

const EmployeeScheduleSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
  assignments: [ScheduledEmployeeSchema],
}, { timestamps: true });

EmployeeScheduleSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeSchedule', EmployeeScheduleSchema);

const mongoose = require('mongoose');

const TimeClockEmployeeSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, required: true },
  lastName:  { type: String, trim: true, required: true },
  position:  { type: String, trim: true, enum: ['Flagger', 'Driver', 'Foreman'], required: true },
  pin:       { type: String, required: true, unique: true },
  active:    { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('TimeClockEmployee', TimeClockEmployeeSchema);

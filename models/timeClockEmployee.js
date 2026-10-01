const mongoose = require('mongoose');

const TimeClockEmployeeSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, required: true },
  lastName:  { type: String, trim: true, required: true },
  position:  { type: String, trim: true, enum: ['Flagger', 'Driver', 'Foreman', 'Custodian', 'Receptionist'], required: true },
  pin:       { type: String, required: true, unique: true },
  location:  { type: String, trim: true, enum: ['North GA', 'South GA'], default: 'North GA' },
  active:    { type: Boolean, default: true },
  handbookReviewed: { type: Boolean, default: false },
  handbookReviewedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('TimeClockEmployee', TimeClockEmployeeSchema);

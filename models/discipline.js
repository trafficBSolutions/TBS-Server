const mongoose = require('mongoose');

const DisciplineSchema = new mongoose.Schema({
  employeeRef:       { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplineEmployee' },
  linkedPersonId:    { type: mongoose.Schema.Types.ObjectId },
  linkedPersonType:  { type: String, enum: ['Employee', 'Admin'] },
  employeeName:      { type: String, required: true },
  position:          { type: String },
  issuedByName:      { type: String },
  supervisorName:    { type: String, required: true },
  dateOfWarning:     { type: Date },
  incidentDate:      { type: Date, required: true },
  incidentTime:      { type: String },
  incidentPeriod:    { type: String, enum: ['AM', 'PM'], default: 'AM' },
  incidentPlace:     { type: String },
  violationTypes:    [{ type: String }],
  otherViolationText:{ type: String },
  employeeStatement: { type: String },
  employerStatement: { type: String },
  decision:          { type: String },
  points:            { type: Number, default: 0, min: 0, max: 3 },
  previousPoints:    { type: Number, default: 0 },
  newTotalPoints:    { type: Number, default: 0 },
  meetingDate:       { type: Date },
  previousWarnings:  [{
    type:   { type: String, enum: ['Verbal', 'Written'] },
    date:   { type: Date },
    byWhom: { type: String }
  }],
  acknowledged:      { type: Boolean, default: false },
  acknowledgedAt:    { type: Date },
  acknowledgedName:  { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Discipline', DisciplineSchema);

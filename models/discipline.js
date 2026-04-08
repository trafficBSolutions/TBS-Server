const mongoose = require('mongoose');

const DisciplineSchema = new mongoose.Schema({
  employeeRef:       { type: mongoose.Schema.Types.ObjectId, ref: 'DisciplineEmployee' },
  employeeName:      { type: String, required: true },
  employeeTitle:     { type: String },
  position:          { type: String },
  issuedByName:      { type: String, required: true },
  issuedByTitle:     { type: String },
  supervisorName:    { type: String, required: true },
  supervisorTitle:   { type: String },
  incidentDate:      { type: Date, required: true },
  incidentTime:      { type: String },
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
  }]
}, { timestamps: true });

module.exports = mongoose.model('Discipline', DisciplineSchema);

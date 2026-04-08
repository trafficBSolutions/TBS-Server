const mongoose = require('mongoose');

const DisciplineSchema = new mongoose.Schema({
  employeeName:      { type: String, required: true },
  employeeTitle:     { type: String },
  department:        { type: String },
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
  meetingDate:       { type: Date },
  previousWarnings:  [{
    type:   { type: String, enum: ['Verbal', 'Written'] },
    date:   { type: Date },
    byWhom: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Discipline', DisciplineSchema);

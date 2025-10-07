const mongoose = require('mongoose');

const priorWarningSchema = new mongoose.Schema({
  type: { type: String, enum: ['Verbal','Written'], required: true },
  date: { type: Date, required: true },
  byWhom: { type: String }
}, {_id:false});

const disciplinaryActionSchema = new mongoose.Schema({
  // Who is being warned
  employeeName: { type: String, required: true },
  employeeTitle: { type: String },
  department: { type: String },

  // Who is filing / issuing the warning
  issuedByName: { type: String, required: true }, // "Person Warning"
  issuedByTitle: { type: String },
  supervisorName: { type: String, required: true },
  supervisorTitle: { type: String },

  // Incident details
  incidentDate: { type: Date, required: true },
  incidentTime: { type: String }, // "HH:mm" or free text "3:00 PM"
  incidentPlace: { type: String },
  violationTypes: [{ type: String }], // ["Attendance","Safety","Work Quality",...]
  otherViolationText: { type: String },

  // Narrative
  employeeStatement: { type: String },
  employerStatement: { type: String }, // aka supervisor/company statement
  decision: { type: String },          // “Warning Decision”
  meetingDate: { type: Date },         // office meeting date (if scheduled)

  // Previous warnings section
  previousWarnings: [priorWarningSchema],

  // Admin flags
  createdBy: { type: String }, // email/uid from token
  files: {
    pdfPath: { type: String }, // server-side path if you choose to persist PDFs
  }
}, { timestamps: true });

module.exports = mongoose.model('DisciplinaryAction', disciplinaryActionSchema);

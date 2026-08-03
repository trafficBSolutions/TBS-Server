const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  school: { type: String, required: true },
  startMonth: { type: String, required: true },
  startYear: { type: String, required: true },
  endMonth: { type: String, required: true },
  endYear: { type: String, required: true }
});

const backgroundSchema = new mongoose.Schema({
  type: { type: String, required: true },
  charge: { type: String, required: true },
  date: { type: String, required: true },
  explanation: { type: String, required: true }
});

const workHistorySchema = new mongoose.Schema({
  employerName: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  phone: { type: String, required: true },
  duties: { type: String, required: true },
  currentlyEmployed: { type: Boolean, required: true },
  reasonForLeaving: { type: String, required: function () { return !this.currentlyEmployed; } },
  mayContact: { type: String, required: true, enum: ["Yes", "No"] }
});

const drivingRecordSchema = new mongoose.Schema({
  speedingTickets: { type: String, default: '0' },
  trafficViolations: { type: String, default: '0' },
  duis: { type: String, default: '0' },
  otherViolations: { type: String, default: '' }
});

const drugScreeningSchema = new mongoose.Schema({
  fullName: { type: String },
  dob: { type: String },
  collectionDate: { type: String },
  specimenId: { type: String },
  testReason: { type: String },
  signature: { type: String }
});

const applySchema = new mongoose.Schema({
  first: { type: String, required: true },
  last: { type: String, required: true },
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  education: [educationSchema],
  position: { type: String, required: true },
  wantsDriver: { type: String, enum: ['Yes', 'No', ''], default: '' },
  drivingRecord: { type: drivingRecordSchema, default: () => ({}) },
  location: { type: String, required: true },
  background: [backgroundSchema],
  languages: { type: String, required: true },
  skills: { type: String, required: true },
  workHistory: [workHistorySchema],
  // Required documents
  idFile: { type: String },                  // Government-issued ID (optional)
  ssnCard: { type: String, required: true },           // Social Security Card
  driversLicense: { type: String, required: true },    // Driver's License
  drivingRecordFile: { type: String, required: true }, // 7-year DMV driving record
  civilianRequest: { type: String, required: true },   // Sheriff's Dept Civilian Request
  // Optional
  cover: { type: String },
  // Fillable forms
  drugScreening: { type: drugScreeningSchema, default: () => ({}) },
  message: { type: String, required: true }
});

applySchema.set('timestamps', true);

const Apply = mongoose.model('Apply', applySchema);

module.exports = Apply;

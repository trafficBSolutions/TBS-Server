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
  currentlyEmployed: { type: Boolean, required: true }, // ✅ Added
  reasonForLeaving: { type: String, required: function () { return !this.currentlyEmployed; } }, // ✅ Required only if NOT currently employed
  mayContact: { type: String, required: true, enum: ["Yes", "No"] } // ✅ Ensures "Yes" or "No"
});


const applySchema = new mongoose.Schema({
  first: { type: String, required: true },
  last: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, unique: true, required: true },
  education: [educationSchema], 
  position: { type: String, required: true },
  location: { type: String, required: true },
  background: [backgroundSchema], 
  languages: { type: String, required: true },
  skills: { type: String, required: true },
  workHistory: [workHistorySchema], 
  resume: { type: String, required: true },
  cover: { type: String },
  message: { type: String, required: true }
});

const Apply = mongoose.model('Apply', applySchema);

module.exports = Apply;

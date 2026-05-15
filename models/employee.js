// models/employee.js
const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, required: true },
  lastName:  { type: String, trim: true, required: true },
  email:     { type: String, trim: true, lowercase: true, unique: true, required: true },
  passwordHash: { type: String, required: true },
  active: { type: Boolean, default: true },
  role: { type: String, default: 'employee', enum: ['employee'] }
}, { timestamps: true });

module.exports = mongoose.model('Employee', EmployeeSchema);

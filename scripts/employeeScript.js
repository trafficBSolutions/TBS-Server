// node scripts/seedEmployees.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('../models/employee'); // from my previous message

const EMPLOYEES = [
  { 
    firstName: process.env.EMP_FIRST_NAME || 'Employee', 
    lastName: process.env.EMP_LAST_NAME || 'TBS', 
    email: process.env.EMP_EMAIL, 
    password: process.env.EMP_PASSWORD 
  },
];

(async () => {
  if (!process.env.MONGO_URL) throw new Error('Missing MONGO_URL');
  if (!process.env.EMP_EMAIL || !process.env.EMP_PASSWORD) {
    throw new Error('Missing EMP_EMAIL or EMP_PASSWORD environment variables');
  }
  await mongoose.connect(process.env.MONGO_URL);
  for (const e of EMPLOYEES) {
    const exists = await Employee.findOne({ email: e.email });
    if (exists) { console.log('Exists:', e.email); continue; }
    const passwordHash = await bcrypt.hash(e.password, 12);
    await Employee.create({ ...e, passwordHash, role: 'employee', active: true });
    console.log('Created:', e.email);
  }
  await mongoose.disconnect();
  console.log('Done.');
})();

// node scripts/addDasia.js
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const TimeClockEmployee = require('../models/timeClockEmployee');

(async () => {
  if (!process.env.MONGO_URL) throw new Error('Missing MONGO_URL');
  await mongoose.connect(process.env.MONGO_URL);

  const exists = await TimeClockEmployee.findOne({ pin: '1223' });
  if (exists) {
    console.log('PIN 1223 already in use by:', exists.firstName, exists.lastName);
    await mongoose.disconnect();
    return;
  }

  await TimeClockEmployee.create({
    firstName: 'Dasia',
    lastName: 'Diskey',
    position: 'Receptionist',
    pin: '1223',
    active: true
  });

  console.log('Added Dasia Diskey (Receptionist) with PIN 1223');
  await mongoose.disconnect();
})();

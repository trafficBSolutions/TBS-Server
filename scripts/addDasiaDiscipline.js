// node scripts/addDasiaDiscipline.js
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const DisciplineEmployee = require('../models/disciplineEmployee');

(async () => {
  if (!process.env.MONGO_URL) throw new Error('Missing MONGO_URL');
  await mongoose.connect(process.env.MONGO_URL);

  const exists = await DisciplineEmployee.findOne({ name: /^dasia diskey$/i });
  if (exists) {
    console.log('Dasia Diskey already exists in discipline roster.');
    await mongoose.disconnect();
    return;
  }

  await DisciplineEmployee.create({
    name: 'Dasia Diskey',
    position: 'Receptionist',
    totalPoints: 0,
    terminated: false
  });

  console.log('Added Dasia Diskey to discipline roster.');
  await mongoose.disconnect();
})();

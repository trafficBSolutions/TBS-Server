require('dotenv').config();
const mongoose = require('mongoose');
const { runInterestReminderCycle } = require('../services/interestBot');

(async () => {
  const MONGO = process.env.MONGO_URL;
  if (!MONGO) throw new Error('MONGO_URL missing');

  try {
    await mongoose.connect(MONGO);
    console.log('[interestBot] Connected. Running interest reminder cycle…');
    await runInterestReminderCycle(new Date());
    console.log('✅ Done.');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();

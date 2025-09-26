require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const { runInterestReminderCycle } = require('../services/interestBot');

(async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log('[interestBot] connected; scheduling daily run at 09:00');

  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[interestBot] daily cycle start');
      await runInterestReminderCycle(new Date());
      console.log('[interestBot] daily cycle done');
    } catch (e) {
      console.error('[interestBot] daily cycle error', e);
    }
  });
})();

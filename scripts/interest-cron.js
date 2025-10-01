// scripts/interest-cron.js
require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const { runInterestReminderCycle } = require('../services/interestBot');

async function safeRun(tag) {
  try {
    console.log(`[interestBot] cycle start (${tag})`);
    await runInterestReminderCycle(new Date());
    console.log('[interestBot] cycle done');
  } catch (e) {
    console.error('[interestBot] cycle error', e);
  }
}

async function main() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.error('❌ MONGO_URL missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[interestBot] connected; scheduling test run every minute');

  // Optional: run once on boot (set INTEREST_RUN_ON_BOOT=1 in Render env)
  if (process.env.INTEREST_RUN_ON_BOOT === '1') {
    await safeRun('boot');
  }

  // Every minute for testing
  cron.schedule(
    '*/1 * * * *',
    () => safeRun('cron every minute TEST'),
    { timezone: 'America/New_York' }
  );

  console.log('[interestBot] worker is idle, waiting for cron…');
}

// Graceful shutdown for Render
process.on('SIGTERM', async () => {
  console.log('[interestBot] SIGTERM: closing Mongo…');
  try { await mongoose.disconnect(); } finally { process.exit(0); }
});
process.on('SIGINT', async () => {
  console.log('[interestBot] SIGINT: closing Mongo…');
  try { await mongoose.disconnect(); } finally { process.exit(0); }
});

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});

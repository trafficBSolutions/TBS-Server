// scripts/backfill-invoice-due-dates.js
require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/invoice');
const ControlUser = require('../models/controluser');

(async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const cursor = Invoice.find({ dueDate: { $exists: false }, job: { $ne: null } }).cursor();
  let updated = 0, checked = 0;

  for await (const inv of cursor) {
    checked++;
    const job = await ControlUser.findById(inv.job).lean().catch(() => null);
    const dueStr = job?.invoiceData?.dueDate; // usually "YYYY-MM-DD"
    if (!dueStr) continue;

    // Treat the stored string as a calendar date; midnight local is fine here
    // If you prefer ET strictly, you can store with -04:00/-05:00 depending on season
    const due = new Date(`${dueStr}T00:00:00Z`);
    await Invoice.updateOne({ _id: inv._id }, { $set: { dueDate: due } });
    updated++;
  }

  console.log(`Backfill done. checked=${checked} updated=${updated}`);
  await mongoose.disconnect();
})();

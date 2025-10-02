// scripts/invoice-numbers.js
const mongoose = require('mongoose');
const Invoice = require('../models/invoice');
const WorkOrder = require('../models/workorder');

(async () => {
  await mongoose.connect(process.env.MONGO_URL);
  const cursor = Invoice.find({ $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: '' }] }).cursor();

  let updated = 0;
  for await (const inv of cursor) {
    let num =
      inv.invoiceNumber ||
      inv.invoiceData?.invoiceNumber;

    if (!num && inv.job) {
      const wo = await WorkOrder.findById(inv.job).lean().catch(() => null);
      num = wo?.invoiceData?.invoiceNumber;
    }
    if (!num) {
      // last resort: keep the legacy short id (don’t love it, but preserves visibility)
      num = String(inv._id).slice(-6);
    }

    await Invoice.updateOne({ _id: inv._id }, { $set: { invoiceNumber: num } });
    updated++;
  }

  console.log('Backfilled invoices:', updated);
  await mongoose.disconnect();
})();

// scripts/backfill-invoice-snapshots.js
require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/invoice');
const WorkOrder = require('../models/workorder');

(async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const cursor = Invoice.find({
    $or: [
      { invoiceData: { $exists: false } },
      { invoiceData: null },
      { invoiceNumber: { $exists: false } }
    ]
  }).cursor();

  let updated = 0;
  for await (const inv of cursor) {
    let wo = null;

    if (inv.job) {
      wo = await WorkOrder.findById(inv.job).lean().catch(() => null);
    }
    if (!wo) {
      wo = await WorkOrder.findOne({ invoiceId: inv._id }).lean().catch(() => null);
    }

    const invoiceData = inv.invoiceData || wo?.invoiceData || null;
    const invoiceNumber =
      inv.invoiceNumber ||
      invoiceData?.invoiceNumber ||
      (wo?._id ? String(wo._id).slice(-6) : String(inv._id).slice(-6));

    const update = {};
    if (invoiceData) update.invoiceData = invoiceData;
    if (invoiceNumber) update.invoiceNumber = invoiceNumber;
    if (invoiceData?.workRequestNumber1) update.workRequestNumber1 = invoiceData.workRequestNumber1;
    if (invoiceData?.workRequestNumber2) update.workRequestNumber2 = invoiceData.workRequestNumber2;

    if (Object.keys(update).length) {
      await Invoice.updateOne({ _id: inv._id }, { $set: update });
      updated++;
    }
  }

  console.log('Backfilled invoices:', updated);
  await mongoose.disconnect();
})();

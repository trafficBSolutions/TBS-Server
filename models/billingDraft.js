const mongoose = require('mongoose');

const billingDraftSchema = new mongoose.Schema({
  type: { type: String, default: 'companyInvoice' },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('BillingDraft', billingDraftSchema);

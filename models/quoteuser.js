const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  date: { type: String, required: true },
  company: { type: String, required: true },
  customer: { type: String, required: true },
  address: String,
  city: String,
  state: String,
  zip: String,
  email: { type: String, required: true },
  phone: String,
  taxRate: Number,
  isTaxExempt: Boolean,
  taxExemptNumber: String,
  payMethod: String,
  rows: [{
    item: String,
    description: String,
    taxable: Boolean,
    qty: Number,
    unitPrice: Number
  }],
  computed: {
    subtotal: Number,
    taxDue: Number,
    ccFee: Number,
    total: Number,
    depositDue: Number
  },
  createdAt: { type: Date, default: Date.now },
  lastSentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quote', quoteSchema);

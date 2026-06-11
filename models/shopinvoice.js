const mongoose = require('mongoose');

const shopInvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true },
  date: { type: String, required: true },
  company: { type: String, required: true },
  customer: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  isTaxExempt: Boolean,
  taxExemptNumber: String,
  payMethod: { type: String },
  cardType: { type: String },
  cardLast4: { type: String },
  checkNumber: { type: String },
  notes: { type: String },
  donation: { type: Number, default: 0 },
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
    total: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShopInvoice', shopInvoiceSchema);

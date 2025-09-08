// models/invoice.js
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const LineItemSchema = new mongoose.Schema({
  description: String,
  qty: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'ControlUser', required: true },
  company: { type: String, required: true },
  companyEmail: { type: String },
  principal: { type: Number, required: true }, // base amount before interest
  interestRate: { type: Number, default: 0.025 }, // 2.5% steps
  status: { type: String, enum: ['DRAFT','SENT','PAID','VOID'], default: 'DRAFT' },
  sentAt: { type: Date },       // set when emailed/saved
  paidAt: { type: Date },
  lineItems: [LineItemSchema],
  workOrderPdfPath: { type: String }, // must be set before sending
  invoicePdfPath: { type: String },
  billedTo: {
    name: String,
    email: String,
    phone: String
  },
  notes: String,
  history: [{ at: Date, action: String, by: String }]
}, { timestamps: true });

InvoiceSchema.index(
  { publicKey: 1 },
  { unique: true, partialFilterExpression: { publicKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Invoice', InvoiceSchema);

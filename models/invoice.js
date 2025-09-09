// models/invoice.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const LineItemSchema = new mongoose.Schema({
  description: String,
  qty: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'ControlUser', required: false },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanUser', required: false },

  company: { type: String, required: true },
  companyEmail: { type: String },

  principal: { type: Number, required: true },    // dollars
  interestRate: { type: Number, default: 0.025 }, // 2.5% per step

  status: { type: String, enum: ['DRAFT','SENT','PAID','VOID'], default: 'DRAFT' },
  sentAt: { type: Date },
  paidAt: { type: Date },

  lineItems: [LineItemSchema],
  workOrderPdfPath: { type: String },
  invoicePdfPath: { type: String },

  billedTo: {
    name: String,
    email: String,
    phone: String
  },

  // NEW: public payment link + reminder bookkeeping
  publicKey: { type: String, unique: true, index: true },
  interestStepsEmailed: { type: Number, default: 0 },
  lastReminderAt: { type: Date },

  // NEW: customer intent + admin bookkeeping
  paymentMethod: { type: String, enum: ['UNSET','CARD','CHECK'], default: 'UNSET' },
  checkPromisedAt: { type: Date },    // customer clicked “I’ll mail a check”
  checkReceivedAt: { type: Date },    // admin put a check in

  notes: String,
  history: [{ at: Date, action: String, by: String }]
}, { timestamps: true });

InvoiceSchema.index({ company: 1, status: 1, sentAt: -1 });

InvoiceSchema.pre('save', function(next) {
  if (!this.publicKey) {
    this.publicKey = crypto.randomBytes(24).toString('base64url');
  }
  next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);

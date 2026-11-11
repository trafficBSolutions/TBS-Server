const mongoose = require('mongoose');

const tcInvoiceSchema = new mongoose.Schema({
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
  workOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' }],
  invoiceNumber: { type: String, required: true },
  invoiceDate: { type: String },
  client: { type: String, required: true },
  clientCompany: { type: String, default: '' },
  clientEmail: { type: String, required: true },
  clientAddress: { type: String, default: '' },
  clientCity: { type: String, default: '' },
  clientZip: { type: String, default: '' },
  description: { type: String, default: '' },
  projectNumber: { type: String, default: '' },
  rows: [{
    _id: false,
    description: { type: String },
    hours: { type: mongoose.Schema.Types.Mixed, default: '' },
    rate: { type: mongoose.Schema.Types.Mixed, default: '' },
    amount: { type: Number, default: 0 },
  }],
  total: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  wosData: [{ type: mongoose.Schema.Types.Mixed }],
  payStatus: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  payMethod: { type: String, default: '' },
  sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('TcInvoice', tcInvoiceSchema);

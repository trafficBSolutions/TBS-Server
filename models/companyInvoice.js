const mongoose = require('mongoose');

const companyInvoiceSchema = new mongoose.Schema({
  company: { type: String, required: true, index: true },
  invoiceNumber: { type: String },
  sentAt: { type: Date, default: Date.now },
  sentTo: { type: String },
  additionalEmails: [{ type: String }],
  payStatus: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  payMethod: { type: String },
  invoicePdfName: { type: String },
  invoicePdfData: { type: Buffer },
  workOrderPdfName: { type: String },
  workOrderPdfData: { type: Buffer },
  remitName: { type: String },
  remitData: { type: Buffer },
}, { timestamps: true });

module.exports = mongoose.model('CompanyInvoice', companyInvoiceSchema);

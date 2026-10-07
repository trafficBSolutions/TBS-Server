const mongoose = require('mongoose');

const companyInvoiceSchema = new mongoose.Schema({
  company: { type: String, required: true, index: true },
  invoiceNumber: { type: String },
  sentAt: { type: Date, default: Date.now },
  sentTo: { type: String },
  additionalEmails: [{ type: String }],
  payStatus: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  payMethod: { type: String },
  lineItems: [{
    _id: false,
    description: { type: String },
    officerAb: { type: String },
    abSignsLights: { type: String },
    mileage: { type: String },
    extra: { type: String },
    amount: { type: Number, default: 0 },
  }],
  invoicePdfName: { type: String },
  invoicePdfData: { type: Buffer },
  workOrderPdfName: { type: String },
  workOrderPdfData: { type: Buffer },
  remitName: { type: String },
  remitData: { type: Buffer },
}, { timestamps: true });

module.exports = mongoose.model('CompanyInvoice', companyInvoiceSchema);

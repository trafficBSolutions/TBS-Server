const mongoose = require('mongoose');

const ShopWorkOrderSchema = new mongoose.Schema({
  employeeNames: { type: String, required: true },
  truckNumber: { type: String, default: '' },
  date: { type: String, required: true },
  inTime: { type: String, required: true },
  outTime: { type: String, required: true },
  location: { type: String, required: true },
  supervisor: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'disapproved'], default: 'pending' },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  submittedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ShopWorkOrder', ShopWorkOrderSchema);

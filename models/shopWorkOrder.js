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
  submittedByEmployeeId: { type: mongoose.Schema.Types.ObjectId, default: null },

  // Admin corrections
  adminCorrections: [{
    field: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    note: { type: String, default: '' },
    editedBy: { type: String },
    editedAt: { type: Date, default: Date.now }
  }],
  adminNotes: { type: String, default: '' },
  adminNotesBy: { type: String, default: '' },
  adminNotesAt: { type: Date },
  hoursFlag: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ShopWorkOrder', ShopWorkOrderSchema);

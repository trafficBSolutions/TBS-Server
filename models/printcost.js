const mongoose = require('mongoose');

const PrintLineSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  length: { type: Number, required: true },
  materialSqFtId: { type: Number, default: 0 },
  laminateSqFtId: { type: Number, default: 0 },
  inks: {
    cyan: { type: Number, default: 0 },
    magenta: { type: Number, default: 0 },
    yellow: { type: Number, default: 0 },
    black: { type: Number, default: 0 },
    lightMagenta: { type: Number, default: 0 },
    lightCyan: { type: Number, default: 0 },
    green: { type: Number, default: 0 },
    orange: { type: Number, default: 0 }
  }
}, { _id: true });

const PrintCostSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopInvoice' },
  invoiceNumber: { type: String, required: true },
  prints: [PrintLineSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrintCost', PrintCostSchema);

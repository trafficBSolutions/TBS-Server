const mongoose = require('mongoose');

const PrintLineSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  length: { type: Number, required: true },
  materialSqFtId: { type: Number, default: 0 },
  lamWidth: { type: Number, default: 0 },
  lamLength: { type: Number, default: 0 },
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

const PrintCostLogSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, required: true },
  author: { type: String },
  prints: [PrintLineSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrintCostLog', PrintCostLogSchema);

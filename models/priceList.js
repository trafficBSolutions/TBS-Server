// models/priceList.js
const mongoose = require('mongoose');

const priceItemSchema = new mongoose.Schema({
  code: { type: String, required: true },   // e.g. FLAG_HALF
  label: String,                             // “Flagging Operation — Half”
  priceCents: { type: Number, required: true },
  unit: { type: String, default: 'each' },   // 'day','mile','each'
  meta: mongoose.Schema.Types.Mixed          // anything else (e.g., category)
});

const mileageSchema = new mongoose.Schema({
  freeMiles: { type: Number, default: 25 },
  rateCentsPerMile: { type: Number, default: 82 }
});

const priceListSchema = new mongoose.Schema({
  companyKey: { type: String, unique: true, index: true },  // e.g. 'wilsonboys'
  items: [priceItemSchema],
  mileage: mileageSchema,
  activeFrom: Date,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('PriceList', priceListSchema);

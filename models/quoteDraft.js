const mongoose = require('mongoose');

const quoteDraftSchema = new mongoose.Schema({
  type: { type: String, enum: ['quote', 'invoice'], required: true },
  label: { type: String },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  savedBy: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('QuoteDraft', quoteDraftSchema);

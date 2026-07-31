const mongoose = require('mongoose');

const hydrovacSchema = new mongoose.Schema({
  first: { type: String, required: true },
  last: { type: String, required: true },
  company: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  serviceType: { type: String, required: true },
  preferredDate: { type: String, required: true },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('HydrovacRequest', hydrovacSchema);

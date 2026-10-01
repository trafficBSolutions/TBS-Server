const mongoose = require('mongoose');

const HandbookAckSchema = new mongoose.Schema({
  firstName:       { type: String, required: true },
  lastName:        { type: String, required: true },
  handbookVersion: { type: String, required: true },  // e.g. "2026-01-07"
  signature:       { type: String },                  // base64 data URI
  signedAt:        { type: Date, default: Date.now },
  source:          { type: String, enum: ['apply', 'employee', 'kiosk'], default: 'employee' }
});

module.exports = mongoose.model('HandbookAck', HandbookAckSchema);

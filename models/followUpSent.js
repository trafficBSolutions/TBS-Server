const mongoose = require('mongoose');

const followUpSentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apply' },
  sentAt: { type: Date, default: Date.now }
});

const FollowUpSent = mongoose.model('FollowUpSent', followUpSentSchema);

module.exports = FollowUpSent;

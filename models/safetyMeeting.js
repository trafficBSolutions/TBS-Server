const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  signature: { type: String },
  signedAt:  { type: Date }
});

const hazardSchema = new mongoose.Schema({
  description:      { type: String, required: true },
  correctiveAction: { type: String },
  resolved:         { type: Boolean, default: false },
  resolvedAt:       { type: Date }
});

const SafetyMeetingSchema = new mongoose.Schema({
  meetingDate:    { type: Date, required: true },
  jobsite:        { type: String, required: true },
  meetingLeader:  { type: String, required: true },
  leaderSignature:{ type: String },

  // Toolbox talk topic (rotating)
  toolboxTopic:   { type: String, required: true },
  topicNotes:     { type: String },

  // Safety topic checkboxes
  topics: {
    trafficControl:     { type: Boolean, default: false },
    ppe:                { type: Boolean, default: false },
    flagging:           { type: Boolean, default: false },
    workZoneSetup:      { type: Boolean, default: false },
    vehicleSafety:      { type: Boolean, default: false },
    heatColdStress:     { type: Boolean, default: false },
    firstAidEmergency:  { type: Boolean, default: false },
    hazardCommunication:{ type: Boolean, default: false },
    slipsTripsFalls:    { type: Boolean, default: false },
    liftingErgonomics:  { type: Boolean, default: false },
    incidentReporting:  { type: Boolean, default: false },
    other:              { type: Boolean, default: false },
    otherText:          { type: String }
  },

  hazards:    [hazardSchema],
  attendees:  [attendeeSchema],  // up to 12

  // Follow-up for unresolved hazards
  followUpRequired:   { type: Boolean, default: false },
  followUpDate:       { type: Date },
  followUpCompletedBy:{ type: String },

  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('SafetyMeeting', SafetyMeetingSchema);

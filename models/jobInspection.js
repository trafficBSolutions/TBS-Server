const mongoose = require('mongoose');

// Each of the 18 inspection items: OK | Deficiency | N/A
const itemSchema = new mongoose.Schema({
  label:            { type: String, required: true },
  status:           { type: String, enum: ['OK', 'Deficiency', 'NA'], default: 'NA' },
  correctiveAction: { type: String }
});

const JobInspectionSchema = new mongoose.Schema({
  inspectionDate: { type: Date, required: true },
  jobsite:        { type: String, required: true },
  inspector:      { type: String, required: true },
  foreman:        { type: String },

  items: {
    type: [itemSchema],
    default: () => [
      { label: 'Traffic-control plan on site and current' },
      { label: 'TCP authorization / permit posted' },
      { label: 'Warning signs present and properly spaced' },
      { label: 'Tapers set to correct length' },
      { label: 'Channelizing devices upright and spaced correctly' },
      { label: 'Arrow board / PCM operating and positioned' },
      { label: 'Flagger(s) in correct position with proper equipment' },
      { label: 'Flagger communications working' },
      { label: 'All workers wearing required PPE (vest, hard hat, safety glasses)' },
      { label: 'Workers staying within protected work zone' },
      { label: 'Vehicles and equipment have backup alarms and lights' },
      { label: 'Trailer / equipment secured and not blocking sight lines' },
      { label: 'Weather / environmental hazards assessed' },
      { label: 'No slip, trip, or fall hazards in work area' },
      { label: 'First-aid kit accessible on site' },
      { label: 'Emergency contact numbers posted or available' },
      { label: 'Work area clean; debris and materials controlled' },
      { label: 'End-of-day closeout: devices stored, signs removed or covered' }
    ]
  },

  // Overall result
  result:          { type: String, enum: ['Pass', 'Fail', 'WorkStopped'], required: true },
  stopWorkReason:  { type: String },

  inspectorSignature: { type: String },
  foremanSignature:   { type: String },

  // Follow-up
  followUpRequired:    { type: Boolean, default: false },
  followUpDate:        { type: Date },
  followUpCompletedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('JobInspection', JobInspectionSchema);

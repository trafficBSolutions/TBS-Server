// models/Complaint.js
const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: String, required: true }, // "Today's Date" from UI (YYYY-MM-DD)
    title: { type: String, required: true }, // driver or foreman
    phone: { type: String, required: true }, // formatted (xxx) xxx-xxxx

    dateOfIncident: { type: String, required: true }, // YYYY-MM-DD
    address: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    zip: { type: String },

    crew: { type: String, required: true },

    incidentPersonName: { type: String, required: true },
    incidentDetail: { type: String, required: true },

    // Using string 'YES' | 'NO' to match the frontend exactly
    firstTime: { type: String, enum: ['YES', 'NO'], required: true },
    priorIncidentCount: { type: String }, // required on UI only if firstTime === 'YES'

    witnesses: { type: String, required: true }, // NOTE: plural to match FE

    message: { type: String, required: true },

    print: { type: String, required: true },

    signatureName: { type: String, required: true },
    signatureBase64: { type: String, required: true }, // base64 (PNG) from canvas
  },
  { timestamps: true }
);

// Optional helpful indexes if you plan to query by date or person
ComplaintSchema.index({ dateOfIncident: 1 });
ComplaintSchema.index({ incidentPersonName: 1 });

module.exports = mongoose.model('Complaint', ComplaintSchema);

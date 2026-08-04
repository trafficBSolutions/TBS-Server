const mongoose = require('mongoose');

const HydrovacWorkOrderSchema = new mongoose.Schema({
  date: { type: String, required: true },
  coordinator: { type: String, required: true, trim: true },
  cdlDriver: { type: String, required: true, trim: true },
  secondWorker: { type: String, required: true, trim: true },

  // Hydrovac metrics
  extensionPipeLength: { type: Number, default: 100 },
  timesDumped: { type: Number, required: true, min: 0 },
  utilitiesFound: { type: Number, required: true, min: 0 },

  // Engine hours
  engineHoursStart: { type: Number, required: true },
  engineHoursEnd: { type: Number, required: true },

  // Mileage
  mileageStart: { type: Number, required: true },
  mileageEnd: { type: Number, required: true },

  // Times
  arrivalAtLocate: { type: String, required: true },
  arrivalBackAtShop: { type: String, required: true },

  // End-of-day checklist
  greasePointsChecked: { type: Boolean, default: false },
  truckCleanedOut: { type: String, enum: ['Yes', 'No'], required: true },
  filterCleaned: { type: String, enum: ['Yes', 'No'], required: true },
  waterRefill: { type: String, enum: ['Yes', 'No'], required: true },

  // Traffic control
  trafficControlUsed: { type: Boolean, default: false },
  tcStartTime: { type: String, default: '' },
  tcEndTime: { type: String, default: '' },
  tcTrucks: [{ type: String }],

  // Signature
  foremanSignature: { type: String, required: true },

  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('HydrovacWorkOrder', HydrovacWorkOrderSchema);

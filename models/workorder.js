const mongoose = require('mongoose');


const CountPairSchema = new mongoose.Schema({
start: { type: Number, required: true, min: 0 },
end: { type: Number, required: true, min: 0 },
}, { _id: false });


const MorningSchema = new mongoose.Schema({
hardHats: { type: CountPairSchema, required: true },
vests: { type: CountPairSchema, required: true },
walkies: { type: CountPairSchema, required: true },
arrowBoards: { type: CountPairSchema, required: true },
cones: { type: CountPairSchema, required: true },
barrels: { type: CountPairSchema, required: true },
signStands: { type: CountPairSchema, required: true },
signs: { type: CountPairSchema, required: true },
}, { _id: false });


const JobsiteSchema = new mongoose.Schema({
visibility: { type: Boolean, required: true },
communication: { type: Boolean, required: true },
siteForeman: { type: Boolean, required: true },
signsAndStands: { type: Boolean, required: true },
conesAndTaper: { type: Boolean, required: true },
equipmentLeft: { type: Boolean, required: true }, // may be enforced true if mismatch
equipmentLeftReason: { type: String, trim: true, default: '' }, // <-- add this
}, { _id: false });


const JobAddressSchema = new mongoose.Schema({
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  zip: { type: String, trim: true },
  project: { type: String, trim: true },
  timeSpent: { type: String, trim: true },
}, { _id: false });

const WorkOrderSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'ControlUser' }, // <-- NOT required
  scheduledDate: { type: Date, required: true },

  basic: {
    dateOfJob: { type: String, required: true },
    client: { type: String, required: true },
    coordinator: { type: String, required: true },
    project: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    rating: { type: String },
    notice24: { type: String },
    callBack: { type: String },
    notes: { type: String },

    // ✅ add this
    foremanName: { type: String, required: true },
    requiresPhotos: { type: Boolean, default: false },
  },

  photos: [{ type: String }], // Array of photo filenames

 foremanSignature: { type: String, required: true },

  tbs: {
    flagger1: { type: String, required: true },
    flagger2: { type: String, required: true },
    flagger3: { type: String },
    flagger4: { type: String },
    flagger5: { type: String },
    flagger6: { type: String },
    trucks: [{ type: String }],
    morning: { type: MorningSchema, required: true },
    jobsite: { type: JobsiteSchema, required: true },
  },

  supervisors: [{ type: String, trim: true }],

  mismatch: { type: Boolean, required: true },

  policeOfficer: {
    used: { type: Boolean, default: false },
    name: { type: String, trim: true, default: '' },
    signature: { type: String, default: '' },
  },

  jobAddresses: [JobAddressSchema],

  // Approval fields
  status: { type: String, enum: ['pending', 'approved', 'disapproved'], default: 'pending' },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },

  // Admin corrections (Dasia/admins editing work orders)
  adminCorrections: [{
    field: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    note: { type: String, default: '' },
    editedBy: { type: String },
    editedAt: { type: Date, default: Date.now }
  }],
  adminNotes: { type: String, default: '' },
  adminNotesBy: { type: String, default: '' },
  adminNotesAt: { type: Date },
  hoursFlag: { type: Boolean, default: false },
}, { timestamps: true });


WorkOrderSchema.index(
  { job: 1, scheduledDate: 1 },
  { unique: true, partialFilterExpression: { job: { $exists: true, $type: "objectId" } } }
);


module.exports = mongoose.model('WorkOrder', WorkOrderSchema);

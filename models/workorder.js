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
}, { _id: false });


const WorkOrderSchema = new mongoose.Schema({
job: { type: mongoose.Schema.Types.ObjectId, ref: 'ControlUser', required: true },
scheduledDate: { type: Date, required: true },


basic: {
dateOfJob: { type: String, required: true }, // YYYY-MM-DD string captured from UI
client: { type: String, required: true },
coordinator: { type: String, required: true },
project: { type: String, required: true },
address: { type: String, required: true },
city: { type: String, required: true },
state: { type: String, required: true },
zip: { type: String, required: true },
startTime: { type: String, required: true }, // HH:MM
endTime: { type: String, required: true }, // HH:MM
rating: { type: String },
notice24: { type: String },
callBack: { type: String },
notes: { type: String },
},


foremanSignature: { type: String, required: true }, // base64 (no prefix), PNG


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


mismatch: { type: Boolean, required: true },
}, { timestamps: true });


WorkOrderSchema.index({ job: 1, scheduledDate: 1 }, { unique: true });


module.exports = mongoose.model('WorkOrder', WorkOrderSchema);

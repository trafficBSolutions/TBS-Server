const mongoose = require('mongoose');

const DisciplineEmployeeSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  position:    { type: String, trim: true },
  totalPoints: { type: Number, default: 0, min: 0 },
  terminated:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('DisciplineEmployee', DisciplineEmployeeSchema);

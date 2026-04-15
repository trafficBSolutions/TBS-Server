const mongoose = require('mongoose');

const signShopJobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  customer: { type: String, trim: true },
  description: { type: String, trim: true },
  date: { type: String, required: true },
  completed: { type: Boolean, default: false },
  author: { type: String, required: true },
  photos: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('SignShopJob', signShopJobSchema);

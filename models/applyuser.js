const mongoose = require('mongoose');
const { Schema } = mongoose;
const uniqueValidator = require('mongoose-unique-validator');
const applicationSchema = new Schema({
  first: {
    type: String,
    required: true
  },
  last: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true // Add unique index
  },
  phone: {
    type: String,
    unique: true // Add unique index
  },
  resume: {
    type: String,
    required: true
  },
  cover: {
    type: String
  },
  message: {
    type: String,
    required: true
  }
});

const Application = mongoose.model('Application', applicationSchema);
applicationSchema.plugin(uniqueValidator); 
module.exports = Application;
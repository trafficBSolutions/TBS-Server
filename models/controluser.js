const mongoose = require('mongoose');

const controlUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    jobDates: [{
        date: Date,
        cancelled: { type: Boolean, default: false },
        cancelledAt: Date
      }],
    company: {
        type: String,
        required: true
    },
    companyKey: { type: String, index: true },   // NEW
    coordinator: {
        type: String,
        required: true
    },
    siteContact: {
        type: String,
    },
    site: {
        type: String,
    },
    time: {
        type: String,
        required: true
    },
    project: {
        type: String,
        required: true
        },
        flagger: {
        type: String,
        required: true
    },
    additionalFlaggers: {
        type: Boolean,
        default: false
    },
    additionalFlaggerCount: {
        type: Number,
        default: 0
    },
    equipment: {
        type: [String],
        required: false
    },
    terms: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },

    city: { 
        type: String,
        required: true
    },

    state: {
        type: String,
        required: true
    },
    zip: { 
        type: String,
        required: true
     },
    message: {
        type: String,
        required: true
    },
    cancelled: {
        type: Boolean,
        default: false
      },
      cancelledAt: {
        type: Date,
        default: null
      },
      emergency: {
  type: Boolean,
  default: false
},
additionalApproval: {
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'n/a'], default: 'n/a' },
  decidedAt: Date
}


}, { timestamps: true });

const ControlUser = mongoose.model('ControlUser', controlUserSchema);

module.exports = ControlUser;

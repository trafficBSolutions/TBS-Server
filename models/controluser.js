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
    coordinator: {
        type: String,
        required: true
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
    equipment: {
        type: [String],
        required: true
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
      }
});

const ControlUser = mongoose.model('ControlUser', controlUserSchema);

module.exports = ControlUser;

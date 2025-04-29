const mongoose = require('mongoose');

const planUserSchema = new mongoose.Schema({
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
    company: {
        type: String,
        required: true
    },
    project: {
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
    structure: {
        type: String, // Assuming you store the file path or URL if a structure file is provided
        required: true
    },
    message: {
        type: String,
        required: true
    }
});

const PlanUser = mongoose.model('PlanUser', planUserSchema);

module.exports = PlanUser;

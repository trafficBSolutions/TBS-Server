const mongoose = require('mongoose');

const ppeuserSchema = new mongoose.Schema({
    first: {
        type: String,
        required: true
    },
    last: {
        type: String,
        required: true
    },
    company: {
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
    ppe: {
        type: String,
        required: true
    },
    ppeimg: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
})

const PPEuser = mongoose.model('PPEuser', ppeuserSchema);

module.exports = PPEuser;
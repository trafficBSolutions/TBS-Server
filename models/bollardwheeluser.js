const mongoose = require('mongoose');

const bollardwheelUserSchema = new mongoose.Schema({
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

    bollard: {
        type: String,
        required: function() {
            return !this.wheel; // Require bollard if wheel is not present
        }
    },
    wheel: {
        type: String,
        required: function() {
            return !this.bollard; // Require wheel if bollard is not present
        }
    },
    message: {
        type: String,
        required: true
    }
});

const BollardWheelUser = mongoose.model('BollardWheelUser', bollardwheelUserSchema);

module.exports = BollardWheelUser;
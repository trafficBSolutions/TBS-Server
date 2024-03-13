const mongoose = require('mongoose');

const signUserSchema = new mongoose.Schema({
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

     reflective: {
        type: String,
        required: true
      },
    size: {
        type: String,
        required: true
      },
    post: {
        type: String
      },
    bracket: {
        type: String
      },
    img: { 
        type: String, // Assuming you store the file path or URL if a structure image is provided
        required: true
     },
    message: {
        type: String,
        required: true
    }
});

const SignUser = mongoose.model('SignUser', signUserSchema);

module.exports = SignUser;
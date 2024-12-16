const mongoose = require('mongoose');

const contactUserSchema = new mongoose.Schema ({
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
    message: {
        type: String,
        required: true
    }
});
const ContactUser = mongoose.model('ContactUser', contactUserSchema);

module.exports = ContactUser;
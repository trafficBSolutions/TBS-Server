const mongoose = require('mongoose');
const directUserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    payMethod: { type: String, required: true },
    bankName: { type: String, required: true },
    accountType: { type: String, required: true },
    accountNumber: { type: String, required: true },
    routingNumber: { type: String, required: true }
});
module.exports = mongoose.model('DirectUser', directUserSchema);

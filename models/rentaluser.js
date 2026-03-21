const mongoose = require('mongoose');

const rentalUserSchema = new mongoose.Schema(
  {
    first: {
      type: String,
      required: true,
      trim: true
    },
    last: {
      type: String,
      required: true,
      trim: true
    },
    company: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    zip: {
      type: String,
      required: true,
      trim: true
    },
    equipment: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    message: {
      type: String,
      default: ''
    },
    orderType: {
      type: String,
      enum: ['rental', 'sale'],
      default: 'rental',
      required: true
    }
  },
  { timestamps: true }
);

const RentalUser = mongoose.model('RentalUser', rentalUserSchema);

module.exports = RentalUser;

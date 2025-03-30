const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  avatar: {
    type: String
  },
  subscription: {
    status: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free'
    },
    planId: {
      type: String
    },
    customerId: {
      type: String
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  payment: {
    pendingOrderId: {
      type: String
    },
    pendingPlanId: {
      type: String
    },
    lastPaymentDate: {
      type: Date
    },
    lastPaymentAmount: {
      type: Number
    }
  },
  usageLimit: {
    type: Number,
    default: 5 // Default limit for free tier
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema); 
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    plan: {
      type: String,
      enum: ['trial', 'starter', 'professional', 'enterprise'],
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'past_due'],
      default: 'active',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
    },
    amount: { type: Number },
    currency: {
      type: String,
      enum: ['INR', 'USD'],
      default: 'INR',
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    paymentHistory: [
      {
        amount: { type: Number },
        currency: { type: String },
        date: { type: Date },
        paymentId: { type: String },
        status: { type: String },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);

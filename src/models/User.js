const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    name: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String },
    addresses: { type: [addressSchema], default: [] },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    isBlocked: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    refreshTokenHash: { type: String },
    resetOtp: { type: String },
    resetOtpExpiry: { type: Date },
    resetOtpAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound unique index: one email per tenant
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);

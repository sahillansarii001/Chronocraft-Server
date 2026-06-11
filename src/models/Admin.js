const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    // tenantId is optional — null for superadmin (global role)
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
    isActive: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    refreshTokenHash: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);

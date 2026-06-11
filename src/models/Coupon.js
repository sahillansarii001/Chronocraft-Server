const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['percentage', 'flat'],
    },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, min: 0 },
    maxUses: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound unique index: one code per tenant
couponSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Coupon', couponSchema);

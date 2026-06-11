'use strict';

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // Admin-created reviews — not tied to a real user account
    reviewerName: { type: String, required: true, trim: true, maxlength: 80 },
    reviewerLocation: { type: String, trim: true, maxlength: 80, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    quote: { type: String, required: true, trim: true, maxlength: 800 },
    // Optional: tie to a product for product-level reviews
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    isPublished: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reviewSchema.index({ tenantId: 1, isPublished: 1, displayOrder: 1 });

module.exports = mongoose.model('Review', reviewSchema);

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    brand: {
      type: String,
      required: true,
      enum: [
        'Rolex',
        'Omega',
        'Patek Philippe',
        'Audemars Piguet',
        'Cartier',
        'IWC',
        'Breitling',
        'Tag Heuer',
        'Longines',
        'Tissot',
        'Other',
      ],
    },
    sku: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    condition: {
      type: String,
      required: true,
      enum: ['New', 'Like New', 'Excellent', 'Good'],
    },
    dial: { type: String },
    caseMaterial: { type: String },
    movement: { type: String },
    gender: {
      type: String,
      enum: ['Men', 'Women', 'Unisex'],
      default: 'Unisex',
    },
    caseSize: { type: Number, min: 0 }, // mm
    yearOfManufacture: { type: Number, min: 1900, max: 2099 },
    includedItems: [{ type: String }],
    images: {
      type: [String],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'At least one image is required.',
      },
    },
    stock: { type: Number, required: true, default: 1, min: 0 },
    tags: [{ type: String }],
    whatsappEnquiry: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound unique indexes per tenant
productSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index({ tenantId: 1, isFeatured: 1 });
productSchema.index({ tenantId: 1, brand: 1 });

module.exports = mongoose.model('Product', productSchema);

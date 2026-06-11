const mongoose = require('mongoose');

const tenantSettingsSchema = new mongoose.Schema(
  {
    whatsappNumber: { type: String },
    whatsappTemplates: {
      orderConfirmation: { type: String },
      statusUpdate: { type: String },
      enquiryReply: { type: String },
      cartAbandonment: { type: String },
    },
    theme: {
      primaryColor: { type: String, default: '#C9A84C' },
      logoUrl: { type: String },
    },
    seo: {
      title: { type: String },
      description: { type: String },
      ogImage: { type: String },
    },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customDomain: { type: String, lowercase: true },
    businessName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: {
      type: String,
      enum: ['trial', 'starter', 'professional', 'enterprise'],
      default: 'trial',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'churned'],
      default: 'trial',
    },
    trialEndsAt: { type: Date },
    settings: { type: tenantSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);

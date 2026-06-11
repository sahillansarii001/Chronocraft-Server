const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
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
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);

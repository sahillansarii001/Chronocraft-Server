const mongoose = require('mongoose');

const whatsAppLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    type: {
      type: String,
      required: true,
      enum: ['enquiry', 'order_confirmation', 'status_update', 'cart_abandonment'],
    },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['sent', 'failed'],
      default: 'sent',
    },
    errorDetails: { type: String },
    isResolved: { type: Boolean, default: false },
    convertedToOrder: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppLog', whatsAppLogSchema);

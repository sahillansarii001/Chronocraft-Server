const mongoose = require('mongoose');

const analyticsDailySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  date: { type: Date, required: true },
  revenue: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },
  newUsers: { type: Number, default: 0 },
  pageViews: { type: Number, default: 0 },
  topProducts: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      sales: { type: Number },
    },
  ],
});

// Unique daily snapshot per tenant
analyticsDailySchema.index({ tenantId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AnalyticsDaily', analyticsDailySchema);

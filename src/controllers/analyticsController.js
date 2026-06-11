'use strict';

const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const WhatsAppLog = require('../models/WhatsAppLog');
const mongoose = require('mongoose');

// GET /api/admin/analytics/summary
exports.getSummary = async (req, res) => {
  const { tenantId } = req;

  try {
    // 1. Total Registered Users
    const totalUsers = await User.countDocuments({ tenantId });

    // 2. Total Sales Revenue
    const revenueResult = await Order.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // 3. Active Orders count
    const activeOrders = await Order.countDocuments({
      tenantId,
      status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] },
    });

    // 4. Low stock products (stock <= 3)
    const lowStockAlerts = await Product.find({
      tenantId,
      stock: { $lte: 3 },
      isArchived: { $ne: true },
    }).lean();

    // 5. WhatsApp enquiries
    const totalEnquiries = await WhatsAppLog.countDocuments({ tenantId, type: 'enquiry' });
    const convertedEnquiries = await WhatsAppLog.countDocuments({ tenantId, type: 'enquiry', convertedToOrder: true });
    const whatsappConversionRate = totalEnquiries > 0 ? Math.round((convertedEnquiries / totalEnquiries) * 100) : 0;

    // 6. Top 5 sold products
    const topProducts = await Order.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          sales: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 5 },
    ]);

    return res.json({
      success: true,
      summary: {
        totalUsers,
        totalRevenue,
        activeOrders,
        lowStockCount: lowStockAlerts.length,
        whatsappEnquiries: totalEnquiries,
        whatsappConversionRate,
      },
      lowStockAlerts,
      topProducts,
    });
  } catch (err) {
    console.error('[Analytics] getSummary error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/analytics/sales
exports.getSalesChart = async (req, res) => {
  const { tenantId } = req;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sales = await Order.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          paymentStatus: 'paid',
          status: { $ne: 'cancelled' },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.json(sales);
  } catch (err) {
    console.error('[Analytics] getSalesChart error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/users
exports.getUsersList = async (req, res) => {
  const { tenantId } = req;

  try {
    const users = await User.find({ tenantId }).select('-passwordHash').lean();

    // Attach order history stats
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const orders = await Order.find({ tenantId, userId: user._id }).lean();
        const totalSpent = orders
          .filter((o) => o.paymentStatus === 'paid' && o.status !== 'cancelled')
          .reduce((sum, o) => sum + o.total, 0);

        return {
          ...user,
          orderCount: orders.length,
          totalSpent,
        };
      })
    );

    return res.json(usersWithStats);
  } catch (err) {
    console.error('[Analytics] getUsersList error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin/whatsapp/logs
exports.getWhatsAppLogs = async (req, res) => {
  const { tenantId } = req;

  try {
    const logs = await WhatsAppLog.find({ tenantId })
      .populate('productId', 'name sku')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(logs);
  } catch (err) {
    console.error('[Analytics] getWhatsAppLogs error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/whatsapp/enquiry (public storefront logging)
exports.logWhatsAppEnquiry = async (req, res) => {
  const { tenantId } = req;
  const { productId, phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ success: false, message: 'Phone and message are required' });
  }

  try {
    const log = await WhatsAppLog.create({
      tenantId,
      productId,
      type: 'enquiry',
      phone,
      message,
      status: 'sent',
    });
    return res.status(201).json({ success: true, log });
  } catch (err) {
    console.error('[Analytics] logWhatsAppEnquiry error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error logging enquiry' });
  }
};

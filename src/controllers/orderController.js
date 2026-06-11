'use strict';

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require('../utils/mailer');

// Helper to generate unique order numbers
function generateOrderNumber() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `CVT-${num}`;
}

// ── Customer Storefront Endpoints ────────────────────────────────────────────

// POST /api/orders
exports.createOrder = async (req, res) => {
  // Enforce customer auth
  if (!req.user || req.user.role !== 'customer') {
    return res.status(401).json({ success: false, message: 'Customer authentication required' });
  }

  const { tenantId, userId } = req.user;
  const { items, subtotal, discount = 0, total, couponCode, shippingAddress, paymentProvider } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  try {
    // 1. Verify stock for each item & prepare items array
    const verifiedItems = [];
    for (const item of items) {
      const product = await Product.findOne({ _id: item.id || item.productId, tenantId });
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.name}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
        });
      }

      verifiedItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: item.quantity,
        image: product.images?.[0] || '',
      });
    }

    // 2. Decrement stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.id || item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // 3. Generate unique order number
    let orderNumber = generateOrderNumber();
    let isUnique = false;
    while (!isUnique) {
      const existing = await Order.findOne({ orderNumber });
      if (!existing) isUnique = true;
      else orderNumber = generateOrderNumber();
    }

    // 4. Create Order
    const statusHistory = [{ status: 'pending', timestamp: new Date(), note: 'Order placed successfully' }];
    const order = await Order.create({
      tenantId,
      userId,
      orderNumber,
      items: verifiedItems,
      subtotal,
      discount,
      total,
      couponCode,
      shippingAddress,
      paymentStatus: 'pending',
      paymentProvider,
      status: 'pending',
      statusHistory,
    });

    // Fire-and-forget confirmation email
    User.findById(userId).lean().then((customer) => {
      if (customer?.email) {
        sendOrderConfirmationEmail({ to: customer.email, name: customer.name, order })
          .catch((e) => console.error('[Mailer] order confirm email failed:', e.message));
      }
    }).catch(() => {});

    return res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('[Orders] createOrder error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { id } = req.params;

  try {
    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Customer can only view their own orders
    if (req.user.role === 'customer' && String(order.userId) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Admin can only view their own tenant's orders
    if (req.user.role === 'admin' && String(order.tenantId) !== String(req.user.tenantId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.json(order);
  } catch (err) {
    console.error('[Orders] getOrderById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/customers/me/orders
exports.getCustomerOrders = async (req, res) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(401).json({ success: false, message: 'Customer authentication required' });
  }

  const { tenantId, userId } = req.user;

  try {
    const orders = await Order.find({ tenantId, userId }).sort({ createdAt: -1 }).lean();
    return res.json(orders);
  } catch (err) {
    console.error('[Orders] getCustomerOrders error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin CMS Endpoints ──────────────────────────────────────────────────────

// GET /api/admin/orders
exports.adminGetOrders = async (req, res) => {
  const { tenantId } = req;

  try {
    const orders = await Order.find({ tenantId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone')
      .lean();
    return res.json(orders);
  } catch (err) {
    console.error('[Orders] adminGetOrders error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin/orders/:id/status
exports.adminUpdateOrderStatus = async (req, res) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { status, paymentStatus, note } = req.body;

  try {
    const order = await Order.findOne({ _id: id, tenantId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status) {
      order.status = status;
      order.statusHistory.push({
        status,
        timestamp: new Date(),
        note: note || `Order status updated to ${status}`,
      });
    }

    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }

    await order.save();

    // Fire-and-forget status update email
    if (status) {
      try {
        const customer = await User.findById(order.userId).lean();
        if (customer?.email) {
          sendOrderStatusEmail({
            to: customer.email,
            name: customer.name,
            order,
            status,
          }).catch((e) => console.error('[Mailer] status email failed:', e.message));
        }
      } catch (_) { /* non-blocking */ }
    }

    return res.json({ success: true, order });
  } catch (err) {
    console.error('[Orders] adminUpdateOrderStatus error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

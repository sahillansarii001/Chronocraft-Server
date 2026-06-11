'use strict';

/**
 * Order Auto-Progression Scheduler
 * ──────────────────────────────────
 * After an admin confirms an order, it automatically advances:
 *
 *   confirmed  ──(24 h)──▶ processing
 *   processing ──(24 h)──▶ shipped       (2 days total from confirmed)
 *   shipped    ──(24 h)──▶ delivered     (3 days total from confirmed)
 *
 * The scheduler runs every 15 minutes and uses statusHistory timestamps
 * to decide when to promote an order to the next stage.
 */

const Order = require('../models/Order');
const User  = require('../models/User');
const { sendOrderStatusEmail } = require('./mailer');

// ── Timing config (milliseconds) ────────────────────────────────────────────
const DELAYS = {
  confirmed:  24 * 60 * 60 * 1000,   // 24 h → move to processing
  processing: 24 * 60 * 60 * 1000,   // 24 h → move to shipped
  shipped:    24 * 60 * 60 * 1000,   // 24 h → move to delivered
};

const NEXT_STATUS = {
  confirmed:  'processing',
  processing: 'shipped',
  shipped:    'delivered',
};

const NOTE = {
  confirmed:  'Order is now being processed.',
  processing: 'Your watch has been dispatched and is on its way.',
  shipped:    'Your luxury timepiece has been delivered. Thank you for choosing Chrono Craft!',
};

// ── Helper: get timestamp of a specific status entry ────────────────────────
function getStatusTimestamp(order, statusKey) {
  const entry = order.statusHistory.find((h) => h.status === statusKey);
  return entry ? new Date(entry.timestamp).getTime() : null;
}

// ── Main job ─────────────────────────────────────────────────────────────────
async function runOrderProgressionJob() {
  try {
    const now = Date.now();

    // Fetch all orders that are still in a promotable state
    const orders = await Order.find({
      status: { $in: ['confirmed', 'processing', 'shipped'] },
    });

    for (const order of orders) {
      const currentStatus  = order.status;
      const delay          = DELAYS[currentStatus];
      const nextStatus     = NEXT_STATUS[currentStatus];
      if (!delay || !nextStatus) continue;

      // When did the order enter its current status?
      const enteredAt = getStatusTimestamp(order, currentStatus);
      if (!enteredAt) continue;

      // Not enough time has passed yet — skip
      if (now - enteredAt < delay) continue;

      // Already promoted (shouldn't happen, but guard against double-run)
      if (order.status !== currentStatus) continue;

      // ── Advance status ──────────────────────────────────────────────────
      order.status = nextStatus;
      order.statusHistory.push({
        status:    nextStatus,
        timestamp: new Date(),
        note:      NOTE[currentStatus],
      });

      await order.save();
      console.log(
        `[Scheduler] Order ${order.orderNumber}: ${currentStatus} → ${nextStatus}`
      );

      // Fire-and-forget customer email
      try {
        const customer = await User.findById(order.userId).lean();
        if (customer?.email) {
          sendOrderStatusEmail({
            to:     customer.email,
            name:   customer.name,
            order,
            status: nextStatus,
          }).catch((e) =>
            console.error(`[Scheduler] Email failed for ${order.orderNumber}:`, e.message)
          );
        }
      } catch (_) { /* non-blocking */ }
    }
  } catch (err) {
    console.error('[Scheduler] orderProgressionJob error:', err.message);
  }
}

// ── Start the scheduler ──────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 15 * 60 * 1000; // check every 15 minutes

function startOrderScheduler() {
  console.log('[Scheduler] Order auto-progression scheduler started (poll every 15 min).');

  // Run once immediately on startup (catches any pending orders from before restart)
  runOrderProgressionJob();

  // Then run on interval
  const timer = setInterval(runOrderProgressionJob, POLL_INTERVAL_MS);

  // Ensure the interval doesn't keep Node alive by itself if server is shutting down
  if (timer.unref) timer.unref();
}

module.exports = { startOrderScheduler };

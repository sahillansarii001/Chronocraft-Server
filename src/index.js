'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { generalLimiter, authLimiter, adminLimiter, orderLimiter } = require('./middleware/rateLimiter');
const { forgotPassword } = require('./controllers/authController');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const { startOrderScheduler } = require('./utils/orderScheduler');

const app = express();

// ── Security & request middleware ────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://chronocraft-client.vercel.app',
      process.env.CORS_ORIGIN
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
// Forgot-password is exempt from rate limiting
app.post('/api/auth/forgot-password', forgotPassword);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', productRoutes);
app.use('/api/orders', orderLimiter);
app.use('/api', orderRoutes);
app.use('/api/admin', adminLimiter);
app.use('/api', analyticsRoutes);
app.use('/api', tenantRoutes);
app.use('/api', uploadRoutes);
app.use('/api', reviewRoutes);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Server] Chrono Craft API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`
    );
  });

  // ── Start background order auto-progression scheduler ──────────────────
  startOrderScheduler();
}

start();

module.exports = app; // exported for testing
// server restart trigger

'use strict';

const Review = require('../models/Review');

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/reviews  — storefront (published only)
exports.getPublicReviews = async (req, res) => {
  const { tenantId } = req;
  try {
    const reviews = await Review.find({ tenantId, isPublished: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return res.json({ success: true, reviews });
  } catch (err) {
    console.error('[Reviews] getPublicReviews error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/admin/reviews
exports.adminGetReviews = async (req, res) => {
  const { tenantId } = req;
  try {
    const reviews = await Review.find({ tenantId })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return res.json({ success: true, reviews });
  } catch (err) {
    console.error('[Reviews] adminGetReviews error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/reviews
exports.adminCreateReview = async (req, res) => {
  const { tenantId } = req;
  const { reviewerName, reviewerLocation, rating, quote, productId, isPublished, displayOrder } = req.body;

  if (!reviewerName || !rating || !quote) {
    return res.status(400).json({ success: false, message: 'reviewerName, rating and quote are required' });
  }

  try {
    const review = await Review.create({
      tenantId,
      reviewerName,
      reviewerLocation: reviewerLocation || '',
      rating: Number(rating),
      quote,
      productId: productId || null,
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
    });
    return res.status(201).json({ success: true, review });
  } catch (err) {
    console.error('[Reviews] adminCreateReview error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// PUT /api/admin/reviews/:id
exports.adminUpdateReview = async (req, res) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { reviewerName, reviewerLocation, rating, quote, productId, isPublished, displayOrder } = req.body;

  try {
    const review = await Review.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          ...(reviewerName !== undefined && { reviewerName }),
          ...(reviewerLocation !== undefined && { reviewerLocation }),
          ...(rating !== undefined && { rating: Number(rating) }),
          ...(quote !== undefined && { quote }),
          ...(productId !== undefined && { productId: productId || null }),
          ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
          ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
        },
      },
      { new: true, runValidators: true }
    );

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    return res.json({ success: true, review });
  } catch (err) {
    console.error('[Reviews] adminUpdateReview error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// DELETE /api/admin/reviews/:id
exports.adminDeleteReview = async (req, res) => {
  const { tenantId } = req;
  const { id } = req.params;

  try {
    const review = await Review.findOneAndDelete({ _id: id, tenantId });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    return res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    console.error('[Reviews] adminDeleteReview error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

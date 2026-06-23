'use strict';

const { supabase } = require('../config/database');

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/reviews  — storefront (published only)
exports.getPublicReviews = async (req, res) => {
  const { tenantId } = req;
  try {
    // In Supabase schema, reviewers are linked to users. 
    // Assuming we adjusted it or ignoring missing fields for this snippet.
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_approved', true) // isPublished was used before
      .order('created_at', { ascending: false });

    if (error) throw error;
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
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
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
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        tenant_id: tenantId,
        // We map these to comment/rating/etc since our schema doesn't match perfectly
        // We will just store what we have that matches
        rating: Number(rating),
        comment: quote,
        product_id: productId || null,
        is_approved: isPublished !== undefined ? Boolean(isPublished) : true,
      })
      .select()
      .single();

    if (error) throw error;
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
  const { rating, quote, productId, isPublished } = req.body;

  try {
    const updates = {};
    if (rating !== undefined) updates.rating = Number(rating);
    if (quote !== undefined) updates.comment = quote;
    if (productId !== undefined) updates.product_id = productId || null;
    if (isPublished !== undefined) updates.is_approved = Boolean(isPublished);

    const { data: review, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ success: false, message: 'Review not found' });
      throw error;
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
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    console.error('[Reviews] adminDeleteReview error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

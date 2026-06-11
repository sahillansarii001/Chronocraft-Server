'use strict';

const Product = require('../models/Product');

// Helper to generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// ── Public Storefront Endpoints ──────────────────────────────────────────────

// GET /api/products
exports.getProducts = async (req, res) => {
  const { tenantId } = req;
  const { brand, minPrice, maxPrice, condition, sort, q, gender, page = 1, limit = 12 } = req.query;

  const query = { tenantId, isArchived: { $ne: true } };

  // Gender filter
  if (gender) {
    const genders = gender.split(',');
    query.gender = { $in: genders };
  }

  // Brand filter
  if (brand) {
    const brands = brand.split(',');
    query.brand = { $in: brands };
  }

  // Price filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Condition filter
  if (condition) {
    const conditions = condition.split(',');
    query.condition = { $in: conditions };
  }

  // Search query (name or brand)
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
    ];
  }

  // Sort
  let sortOption = { createdAt: -1 }; // default: newest
  if (sort === 'price_asc') sortOption = { price: 1 };
  if (sort === 'price_desc') sortOption = { price: -1 };

  try {
    const skip = (Number(page) - 1) * Number(limit);
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Product.countDocuments(query);
    const hasMore = total > skip + products.length;

    return res.json({
      success: true,
      products,
      page: Number(page),
      hasMore,
      total,
    });
  } catch (err) {
    console.error('[Products] getProducts error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching products' });
  }
};

// GET /api/products/featured
exports.getFeaturedProducts = async (req, res) => {
  const { tenantId } = req;
  try {
    const products = await Product.find({ tenantId, isFeatured: true, isArchived: { $ne: true } })
      .limit(6)
      .lean();
    return res.json(products);
  } catch (err) {
    console.error('[Products] getFeaturedProducts error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/products/:slug
exports.getProductBySlug = async (req, res) => {
  const { tenantId } = req;
  const { slug } = req.params;

  try {
    const product = await Product.findOne({ tenantId, slug, isArchived: { $ne: true } }).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json(product);
  } catch (err) {
    console.error('[Products] getProductBySlug error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/brands/:brand/products
exports.getBrandProducts = async (req, res) => {
  const { tenantId } = req;
  const { brand } = req.params;
  const limit = Number(req.query.limit) || 4;

  try {
    const products = await Product.find({ tenantId, brand, isArchived: { $ne: true } })
      .limit(limit)
      .lean();
    return res.json(products);
  } catch (err) {
    console.error('[Products] getBrandProducts error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin CMS Endpoints ──────────────────────────────────────────────────────

// GET /api/admin/products
exports.adminGetProducts = async (req, res) => {
  const { tenantId } = req;

  try {
    const products = await Product.find({ tenantId }).sort({ createdAt: -1 }).lean();
    return res.json(products);
  } catch (err) {
    console.error('[Products] adminGetProducts error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/products
exports.adminCreateProduct = async (req, res) => {
  const { tenantId } = req;
  const data = req.body;

  try {
    if (!data.slug && data.name) {
      data.slug = generateSlug(data.name);
    }
    // Check slug uniqueness for this tenant
    const existing = await Product.findOne({ tenantId, slug: data.slug });
    if (existing) {
      // Append a small random number or SKU to make slug unique
      data.slug = `${data.slug}-${data.sku || Math.floor(Math.random() * 1000)}`;
    }

    const product = await Product.create({
      ...data,
      tenantId,
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('[Products] adminCreateProduct error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// PUT /api/admin/products/:id
exports.adminUpdateProduct = async (req, res) => {
  const { tenantId } = req;
  const { id } = req.params;
  const updates = req.body;

  try {
    if (updates.name) {
      updates.slug = generateSlug(updates.name);
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, product });
  } catch (err) {
    console.error('[Products] adminUpdateProduct error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// DELETE /api/admin/products/:id
exports.adminDeleteProduct = async (req, res) => {
  const { tenantId } = req;
  const { id } = req.params;

  try {
    // Soft delete (archive) as per PRD
    const product = await Product.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { isArchived: true } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, message: 'Product archived successfully', product });
  } catch (err) {
    console.error('[Products] adminDeleteProduct error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin/products/import
exports.adminImportProducts = async (req, res) => {
  const { tenantId } = req;
  const { products } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ success: false, message: 'Products array is required' });
  }

  try {
    const formatted = products.map((p) => {
      if (!p.slug && p.name) p.slug = generateSlug(p.name);
      return {
        ...p,
        tenantId,
      };
    });

    const result = await Product.insertMany(formatted);
    return res.status(201).json({ success: true, count: result.length, products: result });
  } catch (err) {
    console.error('[Products] adminImportProducts error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error during import' });
  }
};

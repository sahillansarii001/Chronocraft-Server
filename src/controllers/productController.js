'use strict';

const { supabase } = require('../config/database');

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

  try {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .neq('is_archived', true);

    // Gender filter
    if (gender) {
      const genders = gender.split(',');
      query = query.in('gender', genders);
    }

    // Brand filter
    if (brand) {
      const brands = brand.split(',');
      query = query.in('brand', brands);
    }

    // Price filter
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }

    // Condition filter
    if (condition) {
      const conditions = condition.split(',');
      query = query.in('condition', conditions);
    }

    // Search query (name or brand)
    if (q) {
      query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
    }

    // Sort
    if (sort === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('price', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const to = skip + Number(limit) - 1;

    const { data: products, count: total, error } = await query.range(skip, to);

    if (error) throw error;

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
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_featured', true)
      .neq('is_archived', true)
      .limit(6);

    if (error) throw error;
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
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .neq('is_archived', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      throw error;
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
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('brand', brand)
      .neq('is_archived', true)
      .limit(limit);

    if (error) throw error;
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
  const { page = 1, limit = 20 } = req.query;

  try {
    const skip = (Number(page) - 1) * Number(limit);
    const to = skip + Number(limit) - 1;

    const { data: products, count: total, error } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(skip, to);

    if (error) throw error;

    const totalPages = Math.ceil(total / Number(limit));

    return res.json({
      success: true,
      products,
      page: Number(page),
      totalPages,
      total
    });
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
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', data.slug)
      .single();

    if (existing) {
      // Append a small random number or SKU to make slug unique
      data.slug = `${data.slug}-${data.sku || Math.floor(Math.random() * 1000)}`;
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        category_id: data.categoryId || data.category,
        name: data.name,
        slug: data.slug,
        brand: data.brand,
        sku: data.sku,
        price: data.price,
        original_price: data.originalPrice,
        condition: data.condition,
        dial: data.dial,
        case_material: data.caseMaterial,
        movement: data.movement,
        gender: data.gender,
        case_size: data.caseSize,
        year_of_manufacture: data.yearOfManufacture,
        included_items: data.includedItems || [],
        images: data.images || [],
        stock: data.stock || 1,
        tags: data.tags || [],
        whatsapp_enquiry: data.whatsappEnquiry,
        is_featured: data.isFeatured,
        is_archived: data.isArchived
      })
      .select()
      .single();

    if (error) throw error;

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

    const { data: product, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      throw error;
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
    // Hard delete
    const { data: product, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      throw error;
    }

    return res.json({ success: true, message: 'Product deleted successfully', product });
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
      let slug = p.slug;
      if (!slug && p.name) slug = generateSlug(p.name);
      return {
        tenant_id: tenantId,
        category_id: p.categoryId || p.category,
        name: p.name,
        slug: slug,
        brand: p.brand,
        sku: p.sku,
        price: p.price,
        original_price: p.originalPrice,
        condition: p.condition,
        dial: p.dial,
        case_material: p.caseMaterial,
        movement: p.movement,
        gender: p.gender,
        case_size: p.caseSize,
        year_of_manufacture: p.yearOfManufacture,
        included_items: p.includedItems || [],
        images: p.images || [],
        stock: p.stock || 1,
        tags: p.tags || [],
        whatsapp_enquiry: p.whatsappEnquiry,
        is_featured: p.isFeatured,
        is_archived: p.isArchived
      };
    });

    const { data: result, error } = await supabase
      .from('products')
      .insert(formatted)
      .select();

    if (error) throw error;
    
    return res.status(201).json({ success: true, count: result.length, products: result });
  } catch (err) {
    console.error('[Products] adminImportProducts error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error during import' });
  }
};

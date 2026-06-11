'use strict';

const Tenant = require('../models/Tenant');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

// GET /api/superadmin/tenants
exports.listTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();

    // Enrich with additional metrics (e.g., admin email)
    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const admin = await Admin.findOne({ tenantId: t._id, role: 'admin' }).select('email').lean();
        return {
          ...t,
          adminEmail: admin?.email || 'N/A',
        };
      })
    );

    return res.json(enriched);
  } catch (err) {
    console.error('[Tenant] listTenants error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error listing tenants' });
  }
};

// POST /api/superadmin/tenants
exports.createTenant = async (req, res) => {
  const { subdomain, businessName, email, password, name, plan } = req.body;

  if (!subdomain || !businessName || !email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'All fields (subdomain, businessName, email, password, name) are required',
    });
  }

  try {
    // 1. Check if subdomain already exists
    const existingTenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
    if (existingTenant) {
      return res.status(409).json({ success: false, message: 'Subdomain already exists' });
    }

    // 2. Check if admin email already exists globally in Admin collection
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({ success: false, message: 'Admin email already in use' });
    }

    // 3. Create Tenant
    const tenant = await Tenant.create({
      subdomain: subdomain.toLowerCase(),
      businessName,
      email: email.toLowerCase(),
      plan: plan || 'trial',
      status: 'active',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
    });

    // 4. Create Tenant settings
    await Settings.create({
      tenantId: tenant._id,
      whatsappNumber: '918850852021', // default
      whatsappTemplates: {
        orderConfirmation: 'Dear {{name}}, your order {{orderNumber}} for {{total}} has been confirmed!',
        statusUpdate: 'Dear {{name}}, your order {{orderNumber}} is now {{status}}.',
        enquiryReply: 'Hello, thank you for enquiring about {{productName}}. How can we assist you?',
        cartAbandonment: 'Hi {{name}}, we noticed you left some luxury timepieces in your cart. Check out now!',
      },
      theme: {
        primaryColor: '#C9A84C',
      },
      seo: {
        title: `${businessName} | Chrono Craft Reseller`,
        description: `Premium luxury watch reseller store powered by Chrono Craft.`,
      },
    });

    // 5. Create Tenant Admin account
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const admin = await Admin.create({
      tenantId: tenant._id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      tenant,
      admin: { id: admin._id, email: admin.email, name: admin.name },
    });
  } catch (err) {
    console.error('[Tenant] createTenant error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Server error creating tenant' });
  }
};

// PUT /api/superadmin/tenants/:id/status
exports.updateTenantStatus = async (req, res) => {
  const { id } = req.params;
  const { status, plan } = req.body;

  try {
    const tenant = await Tenant.findById(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (status) {
      tenant.status = status;
    }
    if (plan) {
      tenant.plan = plan;
    }

    await tenant.save();

    return res.json({ success: true, tenant });
  } catch (err) {
    console.error('[Tenant] updateTenantStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error updating tenant status' });
  }
};

'use strict';

const Tenant = require('../models/Tenant');

/**
 * tenantScope — injects req.tenantId from JWT claim.
 * Verifies the tenant exists and is not suspended.
 * SuperAdmin bypasses the tenant check (tenantId may be null).
 *
 * Apply after `authenticate` middleware.
 */
const tenantScope = async (req, res, next) => {
  // SuperAdmin has global access — no tenant required
  if (req.user && req.user.role === 'superadmin') {
    req.tenantId = req.user.tenantId || null;
    return next();
  }

  const tenantId = req.user && req.user.tenantId;
  if (!tenantId) {
    return res.status(403).json({ success: false, message: 'Tenant context required' });
  }

  try {
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(403).json({ success: false, message: 'Tenant not found' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Tenant account is suspended' });
    }

    req.tenantId = tenantId;
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error('[TenantScope] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * resolveTenantFromHeader — for public routes, reads X-Tenant-ID header
 * or resolves the tenant from the hostname/subdomain of Origin/Referer headers.
 */
const resolveTenantFromHeader = async (req, res, next) => {
  let tenantId = req.headers['x-tenant-id'];

  try {
    let tenant;
    if (tenantId) {
      tenant = await Tenant.findById(tenantId).lean();
    } else {
      // Fallback: Resolve tenant by subdomain from the Origin or Referer header
      const origin = req.headers.origin || req.headers.referer;
      let host = 'localhost';
      if (origin) {
        try {
          const url = new URL(origin);
          host = url.hostname; // e.g. "localhost" or "some-tenant.example.com"
        } catch (_) {}
      }

      // Extract subdomain. E.g. "client1.localhost" -> "client1", or "localhost" -> "localhost"
      let subdomain = host;
      if (host !== 'localhost' && host.includes('.')) {
        const parts = host.split('.');
        // Check if there's a subdomain (e.g., store1.chronosvault.com)
        if (parts.length > 2) {
          subdomain = parts[0];
        }
      }

      tenant = await Tenant.findOne({ subdomain }).lean();
      if (!tenant && host === 'localhost') {
        // Fallback to the default localhost tenant if not found
        tenant = await Tenant.findOne({ subdomain: 'localhost' }).lean();
      }
    }

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Tenant account is suspended' });
    }

    req.tenantId = tenant._id.toString();
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error('[TenantScope] resolveTenantFromHeader error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { tenantScope, resolveTenantFromHeader };

'use strict';

const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const { sendOtpEmail } = require('../utils/mailer');

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLockedOut(account) {
  return account.lockUntil && account.lockUntil > Date.now();
}

function lockoutMinutesRemaining(account) {
  return Math.ceil((account.lockUntil - Date.now()) / 60000);
}

async function handleFailedLogin(account) {
  account.loginAttempts = (account.loginAttempts || 0) + 1;
  if (account.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    account.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  await account.save();
}

async function handleSuccessfulLogin(account) {
  account.loginAttempts = 0;
  account.lockUntil = undefined;
  await account.save();
}

async function issueTokens(payload, account, res) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store hashed refresh token for rotation verification
  account.refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
  await account.save();

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

// ── Customer Register ─────────────────────────────────────────────────────────

exports.customerRegister = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, phone } = req.body;
  // tenantId injected by tenantScope middleware for public routes via header
  const tenantId = req.tenantId || req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'Tenant context missing' });
  }

  try {
    const existing = await User.findOne({ tenantId, email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ tenantId, name, email, passwordHash, phone });

    return res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone || '' },
    });
  } catch (err) {
    console.error('[Auth] customerRegister error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Customer Login ────────────────────────────────────────────────────────────

exports.customerLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;
  const tenantId = req.tenantId || req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ success: false, message: 'Tenant context missing' });
  }

  try {
    const user = await User.findOne({ tenantId, email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account has been blocked' });
    }

    if (isLockedOut(user)) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Try again in ${lockoutMinutesRemaining(user)} minute(s)`,
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await handleFailedLogin(user);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await handleSuccessfulLogin(user);

    const payload = { userId: user._id, tenantId: user.tenantId, role: 'customer', email: user.email };
    const accessToken = await issueTokens(payload, user, res);

    return res.json({
      success: true,
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone || '', role: 'customer' },
    });
  } catch (err) {
    console.error('[Auth] customerLogin error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin Login ───────────────────────────────────────────────────────────────

exports.adminLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (isLockedOut(admin)) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Try again in ${lockoutMinutesRemaining(admin)} minute(s)`,
      });
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      await handleFailedLogin(admin);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await handleSuccessfulLogin(admin);

    const payload = { adminId: admin._id, tenantId: admin.tenantId, role: 'admin', email: admin.email };
    const accessToken = await issueTokens(payload, admin, res);

    return res.json({
      success: true,
      accessToken,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin', tenantId: admin.tenantId },
    });
  } catch (err) {
    console.error('[Auth] adminLogin error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }

  try {
    const decoded = verifyToken(token, 'refresh');

    // Find the account based on role
    let account;
    if (decoded.userId) {
      account = await User.findById(decoded.userId);
    } else if (decoded.adminId) {
      account = await Admin.findById(decoded.adminId);
    }

    if (!account || !account.refreshTokenHash) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const isValid = await bcrypt.compare(token, account.refreshTokenHash);
    if (!isValid) {
      // Possible token reuse — clear stored token
      account.refreshTokenHash = undefined;
      await account.save();
      return res.status(401).json({ success: false, message: 'Refresh token reuse detected' });
    }

    // Build new payload from decoded
    const payload = decoded.userId
      ? { userId: decoded.userId, tenantId: decoded.tenantId, role: decoded.role, email: decoded.email }
      : { adminId: decoded.adminId, tenantId: decoded.tenantId, role: decoded.role, email: decoded.email };

    const newAccessToken = await issueTokens(payload, account, res);

    return res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    res.clearCookie('refreshToken');
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (token) {
    try {
      const decoded = verifyToken(token, 'refresh');
      let account;
      if (decoded.userId) account = await User.findById(decoded.userId);
      else if (decoded.adminId) account = await Admin.findById(decoded.adminId);

      if (account) {
        account.refreshTokenHash = undefined;
        await account.save();
      }
    } catch {
      // Token invalid — still clear cookie
    }
  }

  res.clearCookie('refreshToken');
  return res.json({ success: true, message: 'Logged out successfully' });
};

// ── Forgot Password — send OTP ─────────────────────────────────────────────────

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const tenantId = req.tenantId || req.headers['x-tenant-id'];

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim(), ...(tenantId && { tenantId }) });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);

    user.resetOtp = otpHash;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.resetOtpAttempts = 0;
    await user.save();

    await sendOtpEmail({ to: user.email, name: user.name, otp });

    return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
  } catch (err) {
    console.error('[Auth] forgotPassword error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Verify OTP ────────────────────────────────────────────────────────────────

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const tenantId = req.tenantId || req.headers['x-tenant-id'];

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim(), ...(tenantId && { tenantId }) });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if ((user.resetOtpAttempts || 0) >= 5) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
    }

    const isValid = await bcrypt.compare(otp, user.resetOtp);
    if (!isValid) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // OTP correct — issue a short-lived reset token (just flag on user)
    user.resetOtpAttempts = 0;
    // Keep OTP alive just long enough for the reset step (5 more minutes)
    user.resetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    return res.json({ success: true, message: 'OTP verified. You may now reset your password.' });
  } catch (err) {
    console.error('[Auth] verifyOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const tenantId = req.tenantId || req.headers['x-tenant-id'];

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim(), ...(tenantId && { tenantId }) });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired session. Please start over.' });
    }

    if (user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'Session expired. Please request a new OTP.' });
    }

    const isValid = await bcrypt.compare(otp, user.resetOtp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid session. Please start over.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    user.resetOtpAttempts = 0;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] resetPassword error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Customer Profile ─────────────────────────────────────────────────────────

exports.getCustomerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
      }
    });
  } catch (err) {
    console.error('[Auth] getCustomerProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateCustomerProfile = async (req, res) => {
  const { name, email, phone, currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await User.findOne({ tenantId: user.tenantId, email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email address is already in use' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name) user.name = name.trim();
    user.phone = phone ? phone.trim() : '';

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to change password' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ success: false, message: 'Invalid current password' });
      }
      user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
      }
    });
  } catch (err) {
    console.error('[Auth] updateCustomerProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

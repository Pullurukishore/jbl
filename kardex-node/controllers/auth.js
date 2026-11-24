const asyncHandler = require('express-async-handler');
const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.authenticate = asyncHandler(async (req, res) => {
    const { user_id, password } = req.body;

    // Validate the request
    if (!user_id || !password) {
        return res.status(400).json('Email and password are required');
    }

    // Find the user by email
    const user = await db.user.findOne({ where: { user_id } });

    // Check if the user exists
    if (!user) {
        return res.status(404).json('User not found!');
    }

    // Non-blocking asynchronous password comparison (prevents event-loop stall during shift changes)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If password doesn't match
    if (!isPasswordValid) {
        return res.status(401).json('Invalid password!');
    }

    // Check if the user account is active
    if (user.is_active === false) {
        return res.status(403).json('Account is deactivated. Please contact an administrator.');
    }

    // Sign a JWT token with token_version for instant server-side revocation
    const userData = user.get();
    delete userData.password;
    userData.token_version = user.token_version || 1;

    const id_token = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d',
    });

    // Set secure HttpOnly cookie (auto-detect HTTPS / reverse proxy so plain HTTP LAN doesn't reject cookie)
    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true');
    const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30;
    res.cookie('id_token', id_token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: cookieExpireDays * 24 * 60 * 60 * 1000,
        path: '/'
    });

    res.json({ success: true, data: { ...userData, id_token } });
});

// POST /api/auth/logout - Server-side session invalidation
exports.logout = asyncHandler(async (req, res) => {
    if (req.user?.id) {
        // Increment token_version so any copies of this token are rejected immediately
        await db.user.increment('token_version', { by: 1, where: { id: req.user.id } }).catch(() => {});
    }
    res.clearCookie('id_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me - Verify current session
exports.getMe = asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }
    const user = await db.user.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
    });
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true, data: user });
});
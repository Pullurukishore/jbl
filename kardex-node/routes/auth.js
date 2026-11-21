const express = require("express");
const router = express.Router();
const { authenticate } = require("../controllers/auth");
const { rateLimiter } = require("../middleware/rateLimiter");

// Limit login attempts: max 15 attempts per 15-minute window per IP to prevent brute-force attacks
const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
});

router.post('/authenticate', loginLimiter, authenticate);

module.exports = router;
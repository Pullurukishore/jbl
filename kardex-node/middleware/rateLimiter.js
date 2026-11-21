/**
 * In-memory sliding window rate limiter
 * Protects sensitive endpoints (e.g. login/authentication) against brute-force attacks.
 */

function rateLimiter({
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 20,                  // 20 requests per window
    message = 'Too many requests from this IP, please try again later.'
} = {}) {
    const hits = new Map();

    // Clean up stale IP records every 5 minutes
    const interval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of hits.entries()) {
            if (now > record.resetTime) {
                hits.delete(key);
            }
        }
    }, 5 * 60 * 1000);

    // Don't keep Node process running just for this timer
    if (interval.unref) {
        interval.unref();
    }

    return (req, res, next) => {
        const ip = req.ip ||
            (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : '') ||
            req.connection?.remoteAddress ||
            '127.0.0.1';

        const now = Date.now();
        let record = hits.get(ip);

        if (!record || now > record.resetTime) {
            record = { count: 1, resetTime: now + windowMs };
            hits.set(ip, record);
        } else {
            record.count += 1;
        }

        const remaining = Math.max(0, max - record.count);
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

        if (record.count > max) {
            return res.status(429).json({
                success: false,
                error: message
            });
        }

        next();
    };
}

module.exports = { rateLimiter };

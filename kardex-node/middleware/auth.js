const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const db = require('../models');

//Protect routes
exports.authMiddleware = asyncHandler(async (req, res, next) => {

    let token;

    // Normalize request path without query parameters to prevent auth bypass via query injection
    const rawPath = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+/g, '/').toLowerCase();
    const openEndpoints = ['/api/auth/authenticate'];

    if (openEndpoints.some(endpoint => rawPath === endpoint || rawPath.endsWith(endpoint))) {
        return next();
    }

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token && req.query?.id_token) {
        token = req.query.id_token;
    }

    if (!token)
        return next(new ErrorResponse(`Invalid Session`, 401));

    try {
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return next(new ErrorResponse(`Session Is Expired`, 401));
            } else {
                // const login_data = await db.agg_user_log_generation.findAll({
                //     where: {
                //         login_id: decoded.email,
                //         active: '0'
                //     }
                // });
                if (!decoded?.id) {
                    return next(new ErrorResponse(`Session Is Terminated`, 401));
                }
                const dbUser = await db.user.findByPk(decoded.id, {
                    attributes: ['id', 'role', 'access_type', 'user_id', 'first_name', 'last_name']
                });
                if (!dbUser) {
                    return next(new ErrorResponse(`Session Is Terminated`, 401));
                }
                req.user = {
                    ...decoded,
                    role: dbUser.role,
                    access_type: dbUser.role === 'ADMIN' ? 'BOTH' : (dbUser.access_type || 'BOTH')
                };
                return next();
            }
        });

    } catch (error) {
        console.log(error);
        return next(new ErrorResponse(`unauthorized to access`, 401));
    }
});

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ErrorResponse(`Authentication required`, 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
        }
        next();
    }
}

exports.requireAccess = (operation) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ErrorResponse(`Authentication required`, 401));
        }
        if (req.user.role === 'ADMIN') {
            return next();
        }
        const access = req.user.access_type || 'BOTH';
        const allowed =
            access === 'BOTH' ||
            (operation === 'PUT' && access === 'PUT_ONLY') ||
            (operation === 'PICK' && access === 'PICK_ONLY');

        if (!allowed) {
            return next(new ErrorResponse(`Access denied: ${operation} permission required.`, 403));
        }
        next();
    };
};
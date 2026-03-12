const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const db = require('../models');

//Protect routes
exports.authMiddleware = asyncHandler(async (req, res, next) => {

    let token;

    const openEndpoints = ['api/auth/authenticate'];

    if (openEndpoints.some(url => req.url.includes(url))) {
        return next();
    }

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    const requestsWithTokenInUrl = ['api/put/create', 'api/pick/create'];

    if (requestsWithTokenInUrl.some(url => req.url.includes(url))) {
        token = req.query?.id_token;
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
                req.user = decoded;
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
        if (!roles.includes(req.user.role)) {
            return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
        }
        next();
    }
}
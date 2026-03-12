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

    // Check if the provided password matches the stored hashed password
    const isPasswordValid = bcrypt.compareSync(password, user.password);

    // If password doesn't match
    if (!isPasswordValid) {
        return res.status(401).json('Invalid password!');
    }

    // Sign a JWT token
    const userData = user.get();
    delete userData.password;
    const id_token = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE, // You can change the expiration time as needed
    });

    res.json({ success: true, data: { ...userData, id_token } });
});
const asyncHandler = require('express-async-handler');
const db = require('../models');
const bcrypt = require('bcryptjs');
const { Op, where } = require('sequelize');
const { safeOrder } = require('../utils/sqlSecurity');


const VALID_ACCESS_TYPES = ['PUT_ONLY', 'PICK_ONLY', 'BOTH'];

function normalizeAccessType(role, accessType) {
    if (role === 'ADMIN') return 'BOTH';
    return VALID_ACCESS_TYPES.includes(accessType) ? accessType : 'BOTH';
}

function validatePasswordStrength(pwd) {
    if (!pwd || typeof pwd !== 'string') {
        return 'Password is required.';
    }
    if (pwd.length < 8) {
        return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
        return 'Password must contain at least one letter and one number.';
    }
    return null;
}

exports.createUser = asyncHandler(async (req, res) => {
    try {
        const role = req.body.role || 'USER';
        const access_type = normalizeAccessType(role, req.body.access_type);

        if (req.body.password) {
            const pwdError = validatePasswordStrength(req.body.password);
            if (pwdError) {
                return res.status(400).json({ error: pwdError });
            }
        }

        const hashedPassword = req.body.password
            ? await bcrypt.hash(req.body.password, 10)
            : req.body.password;
        const user = await db.user.create({
            ...req.body,
            password: hashedPassword,
            role,
            access_type,
            token_version: 1,
            created_by: req.user?.id,
            updated_by: req.user?.id
        });
        const result = user.get({ plain: true });
        delete result.password;
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

exports.changePassword = asyncHandler(async (req, res) => {
    try {
        const { id, password } = req.body;
        if (!id || !password) {
            return res.status(400).json({ success: false, error: 'id and password are required.' });
        }
        const pwdError = validatePasswordStrength(password);
        if (pwdError) {
            return res.status(400).json({ success: false, error: pwdError });
        }

        const user = await db.user.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const nextVersion = (user.token_version || 1) + 1;

        // Invalidate all existing sessions by incrementing token_version
        await user.update({
            password: hashedPassword,
            token_version: nextVersion,
            updated_by: req.user?.id
        });

        res.status(200).json({ success: true, message: 'Password updated and previous sessions revoked.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

exports.updateUser = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const role = req.body.role || user.role;
        const access_type = normalizeAccessType(role, req.body.access_type || user.access_type);
        const is_active = req.body.is_active !== undefined ? Boolean(req.body.is_active) : user.is_active;
        await user.update({
            ...req.body,
            role,
            access_type,
            is_active,
            password: user.password,
            updated_by: req.user?.id
        });
        res.status(200).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

exports.getAll = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            size = 10,
            sort = ['id', 'DESC'],
            ...filters
        } = req.query;

        const dialect = db.sequelize.getDialect();
        const uTable = dialect === 'postgres' ? '"user"' : 'user';
        const castText = dialect === 'postgres' ? '::TEXT' : '';

        // Build filtering conditions
        const whereConditions = {};
        Object.keys(filters).forEach((key) => {
            const [column, operation] = key.split('.');
            if (operation) {
                if (!whereConditions[column]) whereConditions[column] = {};
                let val = filters[key];
                if (val === 'true') val = true;
                else if (val === 'false') val = false;

                switch (operation) {
                    case 'greaterThan':
                        whereConditions[column][Op.gt] = val;
                        break;
                    case 'lessThan':
                        whereConditions[column][Op.lt] = val;
                        break;
                    case 'contains':
                        whereConditions[column][Op.like] = `%${val}%`;
                        break;
                    case 'equals':
                        whereConditions[column][Op.eq] = val;
                        break;
                    default:
                        throw new Error(`Unsupported filter operation: ${operation}`);
                }
            }
        });

        if (req.query.search && req.query.search.trim()) {
            const s = req.query.search.trim();
            const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;
            whereConditions[Op.or] = [
                { user_id: { [likeOp]: `%${s}%` } },
                { first_name: { [likeOp]: `%${s}%` } },
                { last_name: { [likeOp]: `%${s}%` } },
                { email: { [likeOp]: `%${s}%` } }
            ];
        }

        // Calculate pagination values
        const offset = (page - 1) * size;
        const limit = parseInt(size, 10);

        // Perform the query
        const { rows, count } = await db.user.findAndCountAll({
            attributes: {
                exclude: ['password'],
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = ${uTable}.created_by)`
                        ),
                        'created_user_first_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = ${uTable}.created_by)`
                        ),
                        'created_user_last_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = ${uTable}.created_by)`
                        ),
                        'created_user_id',
                    ],
                ],
            },
            where: whereConditions,
            order: safeOrder(sort, ['id', 'user_id', 'first_name', 'last_name', 'email', 'role', 'access_type', 'is_active', 'createdAt', 'updatedAt'], 'id', 'DESC'),
            limit,
            offset,
        });

        // Return paginated results
        res.status(200).json({
            data: rows,
            totalItems: count,
            totalPages: Math.ceil(count / size),
            page: parseInt(page, 10),
        });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


exports.toggleStatus = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (req.user?.id == user.id) {
            return res.status(400).json({ error: 'You cannot change your own active status.' });
        }
        const is_active = req.body.is_active !== undefined ? Boolean(req.body.is_active) : !user.is_active;
        await user.update({ is_active, updated_by: req.user?.id });
        res.status(200).json({
            success: true,
            is_active,
            message: `User is now ${is_active ? 'ACTIVE' : 'INACTIVE'}.`
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

exports.deleteUser = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (req.user?.id == user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account.' });
        }
        if (user.is_active !== false) {
            return res.status(400).json({
                error: 'Active users cannot be deleted. Please set user to INACTIVE first before deleting.'
            });
        }
        await user.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

exports.getUser = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        delete user.password;
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});







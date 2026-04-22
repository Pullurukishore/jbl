const asyncHandler = require('express-async-handler');
const db = require('../models');
const bcrypt = require('bcryptjs');
const { Op, where } = require('sequelize');


exports.createUser = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.create({ ...req.body, created_by: req.user?.id, updated_by: req.user?.id });
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

exports.changePassword = asyncHandler(async (req, res) => {
    try {
        const { id, password } = req.body;
        await db.user.update({ password, updated_by: req.user?.id }, { where: { id } });
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

exports.updateUser = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await user.update({ ...req.body, password: user.password, updated_by: req.user?.id });
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
                switch (operation) {
                    case 'greaterThan':
                        whereConditions[column][Op.gt] = filters[key];
                        break;
                    case 'lessThan':
                        whereConditions[column][Op.lt] = filters[key];
                        break;
                    case 'contains':
                        whereConditions[column][Op.like] = `%${filters[key]}%`;
                        break;
                    case 'equals':
                        whereConditions[column][Op.eq] = filters[key];
                        break;
                    default:
                        throw new Error(`Unsupported filter operation: ${operation}`);
                }
            }
        });

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
            order: [[db.sequelize.literal(sort[0]), sort[1]]],
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


exports.deleteUser = asyncHandler(async (req, res) => {
    try {
        const user = await db.user.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
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







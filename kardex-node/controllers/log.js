const asyncHandler = require('express-async-handler');
const db = require('../models');
const { Op } = require('sequelize');


exports.createLog = asyncHandler(async (req, res) => {
    try {
        const log = await db.log.create(req.body);
        res.status(201).json(log);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

exports.getByPutId = asyncHandler(async (req, res) => {
    const dialect = db.sequelize.getDialect();
    const uTable = dialect === 'postgres' ? '"user"' : 'user';
    const castText = dialect === 'postgres' ? '::TEXT' : '';

    const { putId } = req.body;
    const logs = await db.log.findAll({
        where: { put_id: putId, log_type: 'PUT_PROCESS' }, order: [['id', 'ASC']],
        attributes: {
            include: [
                [
                    db.sequelize.literal(
                        `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                    ),
                    'user_first_name',
                ],
                [
                    db.sequelize.literal(
                        `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                    ),
                    'user_last_name',
                ],
                [
                    db.sequelize.literal(
                        `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                    ),
                    'user_id',
                ],
            ],
        }
    });
    res.status(201).json(logs);
});

exports.getByPickId = asyncHandler(async (req, res) => {
    const dialect = db.sequelize.getDialect();
    const uTable = dialect === 'postgres' ? '"user"' : 'user';
    const castText = dialect === 'postgres' ? '::TEXT' : '';

    const { pickId } = req.body;
    const logs = await db.log.findAll({
        where: { pick_id: pickId, log_type: 'PICK_PROCESS' }, order: [['id', 'ASC']],
        attributes: {
            include: [
                [
                    db.sequelize.literal(
                        `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                    ),
                    'user_first_name',
                ],
                [
                    db.sequelize.literal(
                        `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                    ),
                    'user_last_name',
                ],
                [
                    db.sequelize.literal(
                        `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                    ),
                    'user_id',
                ],
            ],
        }
    });
    res.status(201).json(logs);
});

exports.getLastLogsByType = asyncHandler(async (req, res) => {
    try {
        const { entity_number, log_type } = req.body;

        if (!entity_number || !log_type) {
            return res.status(400).json({ error: 'No payload.' });
        }

        const latestLog = await db.log.findOne({
            where: {
                log_type,
                entity_number,
            },
            order: [['log_date_time', 'DESC']],
        });

        if (!latestLog?.id) {
            res.status(200).json([]);
        }

        const logs = await db.log.findAll({
            where: {
                log_type,
                entity_number,
                process_id: latestLog.process_id
            },
            order: [['log_date_time', 'ASC']],
        });
        return res.status(200).json(logs);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

exports.getLogsByForPart = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            size = 10,
            sort = ['id', 'DESC'],
            serialNumber,
            log_type,
            modelNumber,
        } = req.body;

        const dialect = db.sequelize.getDialect();
        const uTable = dialect === 'postgres' ? '"user"' : 'user';
        const castText = dialect === 'postgres' ? '::TEXT' : '';

        // Calculate pagination values
        const offset = (page - 1) * size;
        const limit = parseInt(size, 10);

        const orConditions = [];
        if (serialNumber) {
            orConditions.push({ entity_number: serialNumber });
        }
        if (modelNumber) {
            orConditions.push({ entity_number: modelNumber });
        }

        // Perform the query
        const { rows, count } = await db.log.findAndCountAll({
            where: { [Op.or]: orConditions, ...(log_type && { log_type }) },
            order: [[db.sequelize.literal(sort[0]), sort[1]]],
            limit,
            offset,
            attributes: {
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_first_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_last_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_id',
                    ],
                ],
            }
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
})


exports.getAll = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            size = 10,
            sort = ['id', 'DESC'],
            ...filters
        } = req.body;

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
        const { rows, count } = await db.log.findAndCountAll({
            where: whereConditions,
            order: [[db.sequelize.literal(sort[0]), sort[1]]],
            limit,
            offset,
            attributes: {
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_first_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_last_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_id',
                    ],
                ],
            }
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

exports.getChartData = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            size = 10,
            status
        } = req.body;

        const dialect = db.sequelize.getDialect();
        const uTable = dialect === 'postgres' ? '"user"' : 'user';
        const castText = dialect === 'postgres' ? '::TEXT' : '';

        // Build filtering conditions
        const whereConditions = {
            status,
            log_type: 'PUT_PROCESS'
        };

        // Calculate pagination values
        const offset = (page - 1) * size;
        const limit = parseInt(size, 10);

        // Perform the query
        const { rows, count } = await db.log.findAndCountAll({
            where: whereConditions,
            order: [['log_date_time', 'DESC']],
            limit,
            offset,
            group: ['process_id'],
            attributes: {
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_first_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_last_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by)`
                        ),
                        'user_id',
                    ],
                ],
            }
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

exports.updateLog = asyncHandler(async (req, res) => {
    try {
        const log = await db.log.findByPk(req.params.id);
        if (!log) return res.status(404).json({ error: 'Log not found' });
        await log.update(req.body);
        res.status(200).json(log);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


exports.deleteLog = asyncHandler(async (req, res) => {
    try {
        const log = await db.log.findByPk(req.params.id);
        if (!log) return res.status(404).json({ error: 'Log not found' });
        await log.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

exports.getLog = asyncHandler(async (req, res) => {
    try {
        const log = await db.log.findByPk(req.params.id);
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.status(200).json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});







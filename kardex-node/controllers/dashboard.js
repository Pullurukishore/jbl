const asyncHandler = require('express-async-handler');
const db = require('../models');
const { Op } = require('sequelize');



exports.getAllCounts = asyncHandler(async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        // If the dates are provided, ensure they're in a valid format
        const parsedStartDate = startDate
            ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
            : null;

        const parsedEndDate = endDate
            ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
            : null;

        if (!parsedStartDate || !parsedEndDate) {
            return res.status(400).json({ error: 'No body sent' })
        }

        const validScanCount = await db.log.count({
            where: {
                log_type: 'PUT_PROCESS',
                status: 'SUCCESS',
                ...(parsedStartDate && { log_date_time: { [Op.gte]: parsedStartDate } }),
                ...(parsedEndDate && { log_date_time: { [Op.lte]: parsedEndDate } })
            },
            distinct: true,
            col: 'process_id'
        });

        const invalidScanCount = await db.log.count({
            where: {
                log_type: 'PUT_PROCESS',
                status: 'FAILED',
                ...(parsedStartDate && { log_date_time: { [Op.gte]: parsedStartDate } }),
                ...(parsedEndDate && { log_date_time: { [Op.lte]: parsedEndDate } })
            },
            distinct: true,
            col: 'process_id',
        });


        const dateFilter = (parsedStartDate && parsedEndDate)
            ? { scanned_at: { [Op.gte]: parsedStartDate, [Op.lte]: parsedEndDate } }
            : {};

        const availableParts = await db.put.findAll({
            where: { pick_status: 'AVAILABLE', ...dateFilter }
        });

        const pickedParts = await db.put.findAll({
            where: { pick_status: 'PICKED', ...dateFilter }
        });

        const holdParts = await db.put.findAll({
            where: { pick_status: 'HOLD', ...dateFilter }
        });

        const totalPartsCount = availableParts.length + pickedParts.length + holdParts.length;

        // HU Stats
        const totalHUs = await db.handling_unit.count();
        const inKardexHUs = await db.handling_unit.count({ where: { storage_status: 'IN_KARDEX' } });
        const emptyHUs = await db.handling_unit.count({ where: { hu_status: 'EMPTY', storage_status: 'IN_KARDEX' } });
        const partialHUs = await db.handling_unit.count({ where: { hu_status: 'PARTIALLY_FILLED' } });
        const fullHUs = await db.handling_unit.count({ where: { hu_status: 'FULL' } });
        const draftHUs = await db.handling_unit.count({ where: { storage_status: 'DRAFT' } });

        res.json({
            validScanCount,
            invalidScanCount,
            totalPartsCount,
            holdPartsCount: holdParts.length,
            pickedPartsCount: pickedParts.length,
            availablePartsCount: availableParts.length,
            totalHUs,
            inKardexHUs,
            emptyHUs,
            partialHUs,
            fullHUs,
            draftHUs
        });

    } catch (err) {
        console.error('Dashboard getAllCounts error:', err);
        res.status(500).json({ error: err.message });
    }
});

const asyncHandler = require('express-async-handler');
const db = require('../models');
const { Op } = require('sequelize');

exports.getAllCounts = asyncHandler(async (req, res) => {
    try {
        const { startDate, endDate } = req.body || {};

        // If dates are provided, parse them into full day boundary timestamps
        const parsedStartDate = startDate
            ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
            : null;

        const parsedEndDate = endDate
            ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
            : null;

        const dateFilter = {};
        const logDateFilter = {};

        if (parsedStartDate && parsedEndDate) {
            dateFilter.scanned_at = { [Op.gte]: parsedStartDate, [Op.lte]: parsedEndDate };
            logDateFilter.log_date_time = { [Op.gte]: parsedStartDate, [Op.lte]: parsedEndDate };
        } else if (parsedStartDate) {
            dateFilter.scanned_at = { [Op.gte]: parsedStartDate };
            logDateFilter.log_date_time = { [Op.gte]: parsedStartDate };
        } else if (parsedEndDate) {
            dateFilter.scanned_at = { [Op.lte]: parsedEndDate };
            logDateFilter.log_date_time = { [Op.lte]: parsedEndDate };
        }

        const [
            putValidScans,
            logValidScans,
            invalidScanCount,
            availablePartsCount,
            pickedPartsCount,
            holdPartsCount,
            totalHUs,
            inKardexHUs,
            emptyHUs,
            partialHUs,
            fullHUs,
            draftHUs,
            verticalHUs
        ] = await Promise.all([
            db.put.count({ where: dateFilter }),
            db.log.count({
                where: {
                    log_type: 'PUT_PROCESS',
                    status: 'SUCCESS',
                    ...logDateFilter
                },
                distinct: true,
                col: 'process_id'
            }),
            db.log.count({
                where: {
                    log_type: 'PUT_PROCESS',
                    status: 'FAILED',
                    ...logDateFilter
                },
                distinct: true,
                col: 'process_id',
            }),
            db.put.count({ where: { pick_status: 'AVAILABLE', ...dateFilter } }),
            db.put.count({ where: { pick_status: 'PICKED', ...dateFilter } }),
            db.put.count({ where: { pick_status: 'HOLD', ...dateFilter } }),
            db.handling_unit.count(),
            db.handling_unit.count({ where: { storage_status: 'IN_KARDEX' } }),
            db.handling_unit.count({ where: { hu_status: 'EMPTY' } }),
            db.handling_unit.count({ where: { hu_status: 'PARTIALLY_FILLED' } }),
            db.handling_unit.count({ where: { hu_status: 'FULL' } }),
            db.handling_unit.count({ where: { storage_status: 'DRAFT' } }),
            db.handling_unit.count({
                include: [{
                    model: db.bin_type,
                    where: {
                        [Op.or]: [
                            { bin_name: 'CON_BIND' },
                            { name: { [Op.like]: '%Vertical%' } }
                        ]
                    }
                }]
            }).catch(() => 0)
        ]);

        // Valid scans: highest between actual recorded put operations and successful logs for this date range
        const validScanCount = Math.max(putValidScans, logValidScans);
        const totalPartsCount = availablePartsCount + pickedPartsCount + holdPartsCount;
        const regularHUs = Math.max(0, totalHUs - verticalHUs);

        res.json({
            validScanCount,
            invalidScanCount,
            totalPartsCount,
            holdPartsCount,
            pickedPartsCount,
            availablePartsCount,
            totalHUs,
            inKardexHUs,
            emptyHUs,
            partialHUs,
            fullHUs,
            draftHUs,
            regularHUs,
            verticalHUs
        });

    } catch (err) {
        console.error('Dashboard getAllCounts error:', err);
        res.status(500).json({ error: err.message });
    }
});

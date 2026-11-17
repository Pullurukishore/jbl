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
            return res.status(400).json({ error: 'No body sent' });
        }

        const [validScanCount, invalidScanCount] = await Promise.all([
            db.log.count({
                where: {
                    log_type: 'PUT_PROCESS',
                    status: 'SUCCESS',
                    ...(parsedStartDate && { log_date_time: { [Op.gte]: parsedStartDate } }),
                    ...(parsedEndDate && { log_date_time: { [Op.lte]: parsedEndDate } })
                },
                distinct: true,
                col: 'process_id'
            }),
            db.log.count({
                where: {
                    log_type: 'PUT_PROCESS',
                    status: 'FAILED',
                    ...(parsedStartDate && { log_date_time: { [Op.gte]: parsedStartDate } }),
                    ...(parsedEndDate && { log_date_time: { [Op.lte]: parsedEndDate } })
                },
                distinct: true,
                col: 'process_id',
            })
        ]);

        const dateFilter = (parsedStartDate && parsedEndDate)
            ? { scanned_at: { [Op.gte]: parsedStartDate, [Op.lte]: parsedEndDate } }
            : {};

        const [
            availablePartsCount,
            pickedPartsCount,
            holdPartsCount,
            totalHUs,
            inKardexHUs,
            emptyHUs,
            partialHUs,
            fullHUs,
            draftHUs
        ] = await Promise.all([
            db.put.count({ where: { pick_status: 'AVAILABLE', ...dateFilter } }),
            db.put.count({ where: { pick_status: 'PICKED', ...dateFilter } }),
            db.put.count({ where: { pick_status: 'HOLD', ...dateFilter } }),
            db.handling_unit.count(),
            db.handling_unit.count({ where: { storage_status: 'IN_KARDEX' } }),
            db.handling_unit.count({ where: { hu_status: 'EMPTY', storage_status: 'IN_KARDEX' } }),
            db.handling_unit.count({ where: { hu_status: 'PARTIALLY_FILLED' } }),
            db.handling_unit.count({ where: { hu_status: 'FULL' } }),
            db.handling_unit.count({ where: { storage_status: 'DRAFT' } })
        ]);

        const totalPartsCount = availablePartsCount + pickedPartsCount + holdPartsCount;

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
            draftHUs
        });

    } catch (err) {
        console.error('Dashboard getAllCounts error:', err);
        res.status(500).json({ error: err.message });
    }
});

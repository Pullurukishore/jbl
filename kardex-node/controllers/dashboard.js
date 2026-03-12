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


        const availableParts = await db.put.findAll({
            where: {
                pick_status: 'AVAILABLE', ...(parsedStartDate && { scanned_at: { [Op.gte]: parsedStartDate } }), // Filter if startDate is provided
                ...(parsedEndDate && { scanned_at: { [Op.lte]: parsedEndDate } }), // Filter if endDate is provided 
            }
        });

        const pickedParts = await db.put.findAll({
            where: {
                pick_status: 'PICKED',
                ...(parsedStartDate && { scanned_at: { [Op.gte]: parsedStartDate } }), // Filter if startDate is provided
                ...(parsedEndDate && { scanned_at: { [Op.lte]: parsedEndDate } }), // Filter if endDate is provided 

            }
        });

        const holdParts = await db.put.findAll({
            where: {
                pick_status: 'HOLD',
                ...(parsedStartDate && { scanned_at: { [Op.gte]: parsedStartDate } }), // Filter if startDate is provided
                ...(parsedEndDate && { scanned_at: { [Op.lte]: parsedEndDate } }), // Filter if endDate is provided 
            }
        });

        const totalPartsCount = await db.pick.count({
            where: {
                //status: 'SUCCESS' // Only count rows where status is 'SUCCESS'
            }
        });

        res.json({
            validScanCount,
            invalidScanCount,
            totalPartsCount,
            holdPartsCount: holdParts.length,
            pickedPartsCount: pickedParts.length,
            availablePartsCount: availableParts.length,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
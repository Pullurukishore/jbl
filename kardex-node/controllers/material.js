const asyncHandler = require('express-async-handler');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/material/stats
 * Aggregate overview KPIs for Materials
 */
exports.getMaterialStats = asyncHandler(async (req, res) => {
    try {
        const totalMaterials = await db.put.aggregate('model_number', 'count', {
            distinct: true
        });

        const totalAvailable = await db.put.count({
            where: { pick_status: 'AVAILABLE' }
        });

        const totalHold = await db.put.count({
            where: { pick_status: 'HOLD' }
        });

        const totalPicked = await db.put.count({
            where: { pick_status: 'PICKED' }
        });

        const totalUnits = await db.put.count();

        // Calculate active bins holding materials
        const activeBinsCount = await db.put.aggregate('handling_unit_id', 'count', {
            distinct: true,
            where: {
                handling_unit_id: { [Op.ne]: null },
                pick_status: { [Op.in]: ['AVAILABLE', 'HOLD'] }
            }
        });

        return res.status(200).json({
            totalMaterials: totalMaterials || 0,
            totalAvailable: totalAvailable || 0,
            totalHold: totalHold || 0,
            totalPicked: totalPicked || 0,
            totalUnits: totalUnits || 0,
            activeBinsCount: activeBinsCount || 0
        });
    } catch (err) {
        console.error('getMaterialStats error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch material stats.' });
    }
});

/**
 * POST /api/material/summary
 * Search & paginated aggregation by material/model_number
 */
exports.getMaterialSummary = asyncHandler(async (req, res) => {
    try {
        const {
            search = '',
            statusFilter = 'ALL',
            page = 1,
            size = 15,
            sortField = 'model_number',
            sortDirection = 'ASC'
        } = req.body || {};

        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.max(1, parseInt(size, 10));
        const offset = (pageNum - 1) * pageSize;

        // Base where condition for puts
        const whereClause = {};
        if (search && search.trim() !== '') {
            const trimmed = search.trim();
            whereClause[Op.or] = [
                { model_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } },
                { serial_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } }
            ];
        }

        // Aggregate by model_number
        const rows = await db.put.findAll({
            attributes: [
                'model_number',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total_count'],
                [
                    db.sequelize.literal("COUNT(CASE WHEN pick_status = 'AVAILABLE' THEN 1 ELSE NULL END)"),
                    'available_count'
                ],
                [
                    db.sequelize.literal("COUNT(CASE WHEN pick_status = 'HOLD' THEN 1 ELSE NULL END)"),
                    'hold_count'
                ],
                [
                    db.sequelize.literal("COUNT(CASE WHEN pick_status = 'PICKED' THEN 1 ELSE NULL END)"),
                    'picked_count'
                ],
                [db.sequelize.fn('MAX', db.sequelize.col('scanned_at')), 'last_scanned_at'],
                [db.sequelize.fn('MIN', db.sequelize.col('scanned_at')), 'first_scanned_at']
            ],
            where: whereClause,
            group: ['model_number'],
            raw: true
        });

        // Map and enrich with calculated status
        let enriched = rows.map(r => {
            const available = parseInt(r.available_count || 0, 10);
            const hold = parseInt(r.hold_count || 0, 10);
            const picked = parseInt(r.picked_count || 0, 10);
            const total = parseInt(r.total_count || 0, 10);

            let status = 'IN_STOCK';
            if (available === 0) {
                status = 'OUT_OF_STOCK';
            } else if (available > 0 && available <= 5) {
                status = 'LOW_STOCK';
            }

            return {
                model_number: r.model_number,
                total_count: total,
                available_count: available,
                hold_count: hold,
                picked_count: picked,
                last_scanned_at: r.last_scanned_at,
                first_scanned_at: r.first_scanned_at,
                status
            };
        });

        // Filter by stock status if requested
        if (statusFilter && statusFilter !== 'ALL') {
            if (statusFilter === 'HOLD') {
                enriched = enriched.filter(m => m.hold_count > 0);
            } else {
                enriched = enriched.filter(m => m.status === statusFilter);
            }
        }

        // Sorting
        enriched.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
                return sortDirection.toUpperCase() === 'DESC'
                    ? valB.localeCompare(valA)
                    : valA.localeCompare(valB);
            }

            if (valA instanceof Date || (typeof valA === 'string' && Date.parse(valA))) {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }

            valA = valA || 0;
            valB = valB || 0;
            return sortDirection.toUpperCase() === 'DESC' ? valB - valA : valA - valB;
        });

        const totalItems = enriched.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const pagedData = enriched.slice(offset, offset + pageSize);

        // Fetch active Handling Units for these model numbers on this page
        const pagedModelNumbers = pagedData.map(d => d.model_number);
        if (pagedModelNumbers.length > 0) {
            const activeHUs = await db.put.findAll({
                attributes: ['model_number'],
                where: {
                    model_number: { [Op.in]: pagedModelNumbers },
                    pick_status: { [Op.in]: ['AVAILABLE', 'HOLD'] },
                    handling_unit_id: { [Op.ne]: null }
                },
                include: [{
                    model: db.handling_unit,
                    attributes: ['id', 'hu_id', 'storage_status']
                }],
                raw: true,
                nest: true
            });

            // Group HUs by model_number
            const huMap = {};
            activeHUs.forEach(item => {
                if (!huMap[item.model_number]) {
                    huMap[item.model_number] = [];
                }
                const huId = item.handling_unit?.hu_id;
                if (huId && !huMap[item.model_number].includes(huId)) {
                    huMap[item.model_number].push(huId);
                }
            });

            pagedData.forEach(item => {
                item.handling_units = huMap[item.model_number] || [];
                item.hu_count = item.handling_units.length;
            });
        }

        return res.status(200).json({
            data: pagedData,
            totalItems,
            totalPages,
            page: pageNum,
            size: pageSize
        });
    } catch (err) {
        console.error('getMaterialSummary error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch material summary.' });
    }
});

/**
 * GET /api/material/:modelNumber/details
 * Deep breakdown of a specific material: stock counts, bin locations, and compartments
 */
exports.getMaterialDetails = asyncHandler(async (req, res) => {
    try {
        const { modelNumber } = req.params;
        if (!modelNumber) {
            return res.status(400).json({ error: 'Model number is required.' });
        }

        // Fetch all puts for this model
        const puts = await db.put.findAll({
            where: { model_number: modelNumber },
            include: [
                {
                    model: db.handling_unit,
                    attributes: ['id', 'hu_id', 'storage_status', 'hu_status']
                },
                {
                    model: db.compartment,
                    attributes: ['id', 'compartment_number', 'status']
                }
            ],
            order: [['scanned_at', 'DESC']],
            raw: true,
            nest: true
        });

        if (!puts || puts.length === 0) {
            return res.status(404).json({ error: `Material ${modelNumber} not found.` });
        }

        let availableCount = 0;
        let holdCount = 0;
        let pickedCount = 0;
        const binMap = {};

        puts.forEach(p => {
            if (p.pick_status === 'AVAILABLE') availableCount++;
            else if (p.pick_status === 'HOLD') holdCount++;
            else if (p.pick_status === 'PICKED') pickedCount++;

            // Track active locations (only for available or hold)
            if (p.pick_status !== 'PICKED' && p.handling_unit?.hu_id) {
                const huId = p.handling_unit.hu_id;
                if (!binMap[huId]) {
                    binMap[huId] = {
                        hu_id: huId,
                        storage_status: p.handling_unit.storage_status,
                        hu_status: p.handling_unit.hu_status,
                        units: []
                    };
                }
                binMap[huId].units.push({
                    serial_number: p.serial_number,
                    compartment_number: p.compartment?.compartment_number || 'N/A',
                    pick_status: p.pick_status,
                    pv_status: p.pv_status
                });
            }
        });

        const locations = Object.values(binMap);

        return res.status(200).json({
            model_number: modelNumber,
            total_count: puts.length,
            available_count: availableCount,
            hold_count: holdCount,
            picked_count: pickedCount,
            locations,
            serials_sample: puts.slice(0, 100).map(p => ({
                id: p.id,
                serial_number: p.serial_number,
                pv_status: p.pv_status,
                process_status: p.process_status,
                pick_status: p.pick_status,
                scanned_by: p.scanned_by,
                scanned_at: p.scanned_at,
                birth_date: p.birth_date,
                hu_id: p.handling_unit?.hu_id || null,
                compartment_number: p.compartment?.compartment_number || null
            }))
        });
    } catch (err) {
        console.error('getMaterialDetails error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch material details.' });
    }
});

/**
 * POST /api/material/:modelNumber/serials
 * Paginated / searchable list of all serials for a material
 */
exports.getMaterialSerials = asyncHandler(async (req, res) => {
    try {
        const { modelNumber } = req.params;
        const {
            search = '',
            status = 'ALL',
            page = 1,
            size = 20
        } = req.body || {};

        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.max(1, parseInt(size, 10));
        const offset = (pageNum - 1) * pageSize;

        const where = {
            model_number: modelNumber
        };

        if (status && status !== 'ALL') {
            where.pick_status = status;
        }

        if (search && search.trim() !== '') {
            where.serial_number = { [Op.iLike ? Op.iLike : Op.like]: `%${search.trim()}%` };
        }

        const { count, rows } = await db.put.findAndCountAll({
            where,
            include: [
                {
                    model: db.handling_unit,
                    attributes: ['id', 'hu_id', 'storage_status']
                },
                {
                    model: db.compartment,
                    attributes: ['id', 'compartment_number']
                }
            ],
            order: [['scanned_at', 'DESC']],
            limit: pageSize,
            offset,
            raw: true,
            nest: true
        });

        const formattedRows = rows.map(p => ({
            id: p.id,
            serial_number: p.serial_number,
            pv_status: p.pv_status,
            process_status: p.process_status,
            pick_status: p.pick_status,
            scanned_by: p.scanned_by,
            scanned_at: p.scanned_at,
            birth_date: p.birth_date,
            hu_id: p.handling_unit?.hu_id || null,
            compartment_number: p.compartment?.compartment_number || null
        }));

        return res.status(200).json({
            data: formattedRows,
            totalItems: count,
            totalPages: Math.ceil(count / pageSize) || 1,
            page: pageNum,
            size: pageSize
        });
    } catch (err) {
        console.error('getMaterialSerials error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch material serials.' });
    }
});


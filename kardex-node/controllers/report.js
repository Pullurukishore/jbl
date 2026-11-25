const asyncHandler = require('express-async-handler');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Helper to calculate age in days and hours
 */
function calculateAge(fromDate, toDate = new Date()) {
    if (!fromDate) return { days: 0, hours: 0, minutes: 0, totalHours: 0 };
    const diffMs = Math.max(0, toDate.getTime() - new Date(fromDate).getTime());
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, totalHours };
}

/**
 * Classify inventory age into standard buckets
 */
function getAgeBucket(days, totalHours) {
    if (totalHours !== undefined && totalHours < 24) return '<24h';
    if (days <= 3) return '1-3';
    if (days <= 7) return '4-7';
    if (days <= 15) return '8-15';
    if (days <= 30) return '16-30';
    if (days <= 60) return '31-60';
    if (days <= 120) return '61-120';
    return '120+';
}

/**
 * Classify Kanban dwell time into SLA status
 */
function getKanbanSlaStatus(totalHours) {
    if (totalHours < 24) return 'NORMAL';       // < 24 hrs
    if (totalHours < 48) return 'ATTENTION';    // 24 - 48 hrs
    if (totalHours < 72) return 'WARNING';      // 48 - 72 hrs
    return 'OVERDUE';                           // > 72 hrs (3+ days)
}

/**
 * GET /api/report/aging/stats
 * Overview KPIs for Serial Number Aging & Kanban In Aging Check
 */
exports.getAgingStats = asyncHandler(async (req, res) => {
    try {
        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const d15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

        const activeFilter = { pick_status: { [Op.in]: ['AVAILABLE', 'HOLD'] } };

        // 1. Overall Inventory Counts
        const [
            totalActive,
            totalAvailable,
            totalHold,
            totalPicked,
            bucket0to7,
            bucket8to15,
            bucket16to30,
            bucket31to60,
            bucket60plus,
            oldestActiveUnit
        ] = await Promise.all([
            db.put.count({ where: activeFilter }),
            db.put.count({ where: { pick_status: 'AVAILABLE' } }),
            db.put.count({ where: { pick_status: 'HOLD' } }),
            db.put.count({ where: { pick_status: 'PICKED' } }),
            db.put.count({ where: { ...activeFilter, scanned_at: { [Op.gte]: d7 } } }),
            db.put.count({ where: { ...activeFilter, scanned_at: { [Op.lt]: d7, [Op.gte]: d15 } } }),
            db.put.count({ where: { ...activeFilter, scanned_at: { [Op.lt]: d15, [Op.gte]: d30 } } }),
            db.put.count({ where: { ...activeFilter, scanned_at: { [Op.lt]: d30, [Op.gte]: d60 } } }),
            db.put.count({ where: { ...activeFilter, scanned_at: { [Op.lt]: d60 } } }),
            db.put.findOne({
                where: activeFilter,
                order: [['scanned_at', 'ASC']],
                attributes: ['id', 'serial_number', 'model_number', 'scanned_at', 'birth_date']
            })
        ]);

        // 2. Kanban-In Specific Counts
        const kanbanFilter = {
            ...activeFilter,
            process_status: { [Op.in]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] }
        };

        const [
            totalKanbanActive,
            kanbanReturnsActive,
            kanbanSlaNormal,
            kanbanSlaAttention,
            kanbanSlaWarning,
            kanbanSlaOverdue,
            oldestKanbanUnit
        ] = await Promise.all([
            db.put.count({ where: kanbanFilter }),
            db.put.count({
                where: {
                    ...activeFilter,
                    process_status: { [Op.in]: ['KANBAN-RTN', 'KANBAN_RTN'] }
                }
            }),
            db.put.count({ where: { ...kanbanFilter, scanned_at: { [Op.gte]: h24 } } }),
            db.put.count({ where: { ...kanbanFilter, scanned_at: { [Op.lt]: h24, [Op.gte]: h48 } } }),
            db.put.count({ where: { ...kanbanFilter, scanned_at: { [Op.lt]: h48, [Op.gte]: h72 } } }),
            db.put.count({ where: { ...kanbanFilter, scanned_at: { [Op.lt]: h72 } } }),
            db.put.findOne({
                where: kanbanFilter,
                order: [['scanned_at', 'ASC']],
                attributes: ['id', 'serial_number', 'model_number', 'scanned_at', 'process_status']
            })
        ]);

        let oldestActiveFormatted = null;
        if (oldestActiveUnit) {
            const age = calculateAge(oldestActiveUnit.scanned_at, now);
            oldestActiveFormatted = {
                serial_number: oldestActiveUnit.serial_number,
                model_number: oldestActiveUnit.model_number,
                scanned_at: oldestActiveUnit.scanned_at,
                age_days: age.days,
                age_hours: age.hours
            };
        }

        let oldestKanbanFormatted = null;
        if (oldestKanbanUnit) {
            const age = calculateAge(oldestKanbanUnit.scanned_at, now);
            oldestKanbanFormatted = {
                serial_number: oldestKanbanUnit.serial_number,
                model_number: oldestKanbanUnit.model_number,
                scanned_at: oldestKanbanUnit.scanned_at,
                process_status: oldestKanbanUnit.process_status,
                dwell_hours: age.totalHours,
                dwell_days: age.days
            };
        }

        return res.status(200).json({
            inventory: {
                totalActive: totalActive || 0,
                totalAvailable: totalAvailable || 0,
                totalHold: totalHold || 0,
                totalPicked: totalPicked || 0,
                oldestUnit: oldestActiveFormatted,
                buckets: {
                    '0-7': bucket0to7 || 0,
                    '8-15': bucket8to15 || 0,
                    '16-30': bucket16to30 || 0,
                    '31-60': bucket31to60 || 0,
                    '60+': bucket60plus || 0
                }
            },
            kanban: {
                totalActive: totalKanbanActive || 0,
                returnsCount: kanbanReturnsActive || 0,
                oldestUnit: oldestKanbanFormatted,
                sla: {
                    normal: kanbanSlaNormal || 0,
                    attention: kanbanSlaAttention || 0,
                    warning: kanbanSlaWarning || 0,
                    overdue: kanbanSlaOverdue || 0
                }
            }
        });
    } catch (err) {
        console.error('getAgingStats error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch aging stats.' });
    }
});

/**
 * POST /api/report/aging/serial
 * Paginated report for Unified Serial Number & Kanban In Aging
 */
exports.getSerialAgingList = asyncHandler(async (req, res) => {
    try {
        const {
            search = '',
            ageBucket = 'ALL',
            slaStatus = 'ALL',
            processStatus = 'ALL', // 'ALL', 'KANBAN_ONLY', 'KANBAN-IN', 'KANBAN-RTN', 'STANDARD_PUT'
            pickStatus = 'ACTIVE', // 'ACTIVE' (AVAILABLE+HOLD), 'ALL', 'AVAILABLE', 'HOLD', 'PICKED'
            modelNumber = '',
            startDate = null,
            endDate = null,
            page = 1,
            size = 100,
            sortField = 'scanned_at',
            sortDirection = 'ASC' // Default ASC for FIFO priority (oldest first)
        } = req.body || {};

        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.max(1, parseInt(size, 10));
        const offset = (pageNum - 1) * pageSize;
        const now = new Date();

        const whereClause = {};

        // Pick Status filter
        if (pickStatus === 'ACTIVE') {
            whereClause.pick_status = { [Op.in]: ['AVAILABLE', 'HOLD'] };
        } else if (pickStatus && pickStatus !== 'ALL') {
            whereClause.pick_status = pickStatus;
        }

        // Process Status filter
        if (processStatus === 'KANBAN_ONLY') {
            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };
        } else if (processStatus === 'KANBAN-IN') {
            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN'] };
        } else if (processStatus === 'KANBAN-RTN') {
            whereClause.process_status = { [Op.in]: ['KANBAN-RTN', 'KANBAN_RTN'] };
        } else if (processStatus === 'STANDARD_PUT') {
            whereClause.process_status = { [Op.notIn]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };
        }

        // Model Number filter (case-insensitive partial match)
        if (modelNumber && modelNumber.trim() !== '') {
            const trimmedModel = modelNumber.trim();
            whereClause.model_number = { [Op.iLike ? Op.iLike : Op.like]: `%${trimmedModel}%` };
        }

        // Search filter (serial or model)
        if (search && search.trim() !== '') {
            const trimmed = search.trim();
            whereClause[Op.or] = [
                { serial_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } },
                { model_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } }
            ];
        }

        // Date range on scanned_at
        if (startDate || endDate) {
            whereClause.scanned_at = {};
            if (startDate) {
                whereClause.scanned_at[Op.gte] = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            }
            if (endDate) {
                whereClause.scanned_at[Op.lte] = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            }
        }

        // Age Bucket filter
        if (ageBucket && ageBucket !== 'ALL') {
            const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const d1 = h24;
            const d3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const d15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            const d120 = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

            if (ageBucket === '<24h' || ageBucket === '0-1') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: h24 };
            } else if (ageBucket === '1-3') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d1, [Op.gte]: d3 };
            } else if (ageBucket === '4-7') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d3, [Op.gte]: d7 };
            } else if (ageBucket === '0-7') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: d7 };
            } else if (ageBucket === '8-15') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d7, [Op.gte]: d15 };
            } else if (ageBucket === '16-30') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d15, [Op.gte]: d30 };
            } else if (ageBucket === '31-60') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d30, [Op.gte]: d60 };
            } else if (ageBucket === '61-120') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d60, [Op.gte]: d120 };
            } else if (ageBucket === '120+') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d120 };
            } else if (ageBucket === '60+') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d60 };
            } else if (ageBucket === '30+' || ageBucket === 'CRITICAL_30_PLUS') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d30 };
            }
        }

        // SLA Status filter (applies to Kanban items)
        if (slaStatus && slaStatus !== 'ALL') {
            const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
            const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };

            if (slaStatus === 'NORMAL') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: h24 };
            } else if (slaStatus === 'ATTENTION') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h24, [Op.gte]: h48 };
            } else if (slaStatus === 'WARNING') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h48, [Op.gte]: h72 };
            } else if (slaStatus === 'OVERDUE') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h72 };
            }
        }

        // Sorting mapping
        const allowedSort = ['scanned_at', 'birth_date', 'serial_number', 'model_number', 'pick_status'];
        const safeSortField = allowedSort.includes(sortField) ? sortField : 'scanned_at';
        const safeSortDir = sortDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const orderClause = safeSortField === 'birth_date'
            ? [[safeSortField, `${safeSortDir} NULLS LAST`]]
            : [[safeSortField, safeSortDir]];

        const { count, rows } = await db.put.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: db.handling_unit,
                    attributes: ['id', 'hu_id', 'storage_status', 'bin_type_id'],
                    include: [{ model: db.bin_type, attributes: ['bin_name', 'name'] }]
                },
                {
                    model: db.compartment,
                    attributes: ['id', 'compartment_number', 'status']
                },
                {
                    model: db.pick,
                    attributes: ['id', 'scanned_at'],
                    required: false
                }
            ],
            order: orderClause,
            limit: pageSize,
            offset: offset
        });

        // Enrich items with both Serial Aging and Kanban Aging calculations
        const items = rows.map(r => {
            const inDate = r.scanned_at || r.createdAt;
            const isPicked = r.pick_status === 'PICKED' || Boolean(r.pick_id);
            const pickTimestamp = isPicked ? (r.pick?.scanned_at || r.updatedAt || null) : null;
            const outDate = isPicked ? (pickTimestamp || now) : now;
            const inOutAge = calculateAge(inDate, outDate);
            const kardexAge = calculateAge(r.scanned_at, now);
            const birthAge = r.birth_date ? calculateAge(r.birth_date, now) : null;
            const birthToInAge = (r.birth_date && r.scanned_at) ? calculateAge(r.birth_date, new Date(r.scanned_at)) : null;
            const bucket = getAgeBucket(inOutAge.days, inOutAge.totalHours);

            const isKanban = ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-OUT', 'KANBAN_OUT', 'KANBAN-RTN', 'KANBAN_RTN'].some(k =>
                r.process_status?.toUpperCase()?.includes(k)
            );
            const kanbanSla = isKanban ? getKanbanSlaStatus(inOutAge.totalHours) : null;

            return {
                id: r.id,
                serial_number: r.serial_number,
                model_number: r.model_number,
                process_status: r.process_status,
                pick_status: r.pick_status,
                pv_status: r.pv_status,
                scanned_at: r.scanned_at,
                birth_date: r.birth_date,
                scanned_by: r.scanned_by,
                hu_id: r.handling_unit?.hu_id || null,
                bin_type: r.handling_unit?.bin_type?.bin_name || r.handling_unit?.bin_type?.name || null,
                storage_status: r.handling_unit?.storage_status || null,
                compartment_number: r.compartment?.compartment_number || null,
                compartment_status: r.compartment?.status || (r.compartment?.compartment_number ? 'OCCUPIED' : null),
                birth_to_in_days: birthToInAge ? birthToInAge.days : null,
                birth_to_in_hours: birthToInAge ? birthToInAge.hours : null,
                birth_to_in_formatted: birthToInAge ? `${birthToInAge.days}d ${birthToInAge.hours}h` : 'N/A',
                kanban_in_out_days: inOutAge.days,
                kanban_in_out_hours: inOutAge.hours,
                kanban_in_out_minutes: inOutAge.minutes,
                kanban_in_out_formatted: `${inOutAge.days}d ${inOutAge.hours}h ${inOutAge.minutes}m`,
                is_picked: isPicked,
                pick_date: isPicked ? outDate : null,
                kardex_age_days: inOutAge.days,
                kardex_age_hours: inOutAge.hours,
                kardex_age_minutes: inOutAge.minutes,
                kardex_total_hours: inOutAge.totalHours,
                birth_age_days: birthAge ? birthAge.days : null,
                age_bucket: bucket,
                is_kanban: isKanban,
                kanban_dwell_hours: isKanban ? inOutAge.totalHours : null,
                kanban_dwell_days: isKanban ? inOutAge.days : null,
                kanban_dwell_minutes: isKanban ? inOutAge.minutes : null,
                kanban_sla_status: kanbanSla
            };
        });

        return res.status(200).json({
            data: items,
            totalItems: count,
            totalPages: Math.ceil(count / pageSize),
            page: pageNum,
            size: pageSize
        });
    } catch (err) {
        console.error('getSerialAgingList error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch serial aging list.' });
    }
});

/**
 * POST /api/report/aging/kanban
 * Paginated report for Kanban In Aging Check
 */
exports.getKanbanAgingList = asyncHandler(async (req, res) => {
    try {
        const {
            search = '',
            slaStatus = 'ALL', // 'ALL', 'NORMAL', 'ATTENTION', 'WARNING', 'OVERDUE'
            processStatus = 'ALL', // 'ALL', 'KANBAN-IN', 'KANBAN-RTN'
            pickStatus = 'ACTIVE', // 'ACTIVE', 'ALL', 'AVAILABLE', 'HOLD', 'PICKED'
            modelNumber = '',
            startDate = null,
            endDate = null,
            page = 1,
            size = 100,
            sortField = 'scanned_at',
            sortDirection = 'ASC' // Default oldest first
        } = req.body || {};

        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.max(1, parseInt(size, 10));
        const offset = (pageNum - 1) * pageSize;
        const now = new Date();

        const whereClause = {};

        // Base process filter: only Kanban records
        if (processStatus === 'KANBAN-IN') {
            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN'] };
        } else if (processStatus === 'KANBAN-RTN') {
            whereClause.process_status = { [Op.in]: ['KANBAN-RTN', 'KANBAN_RTN'] };
        } else {
            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };
        }

        // Pick status filter
        if (pickStatus === 'ACTIVE') {
            whereClause.pick_status = { [Op.in]: ['AVAILABLE', 'HOLD'] };
        } else if (pickStatus && pickStatus !== 'ALL') {
            whereClause.pick_status = pickStatus;
        }

        // Model Number filter (case-insensitive partial match)
        if (modelNumber && modelNumber.trim() !== '') {
            const trimmedModel = modelNumber.trim();
            whereClause.model_number = { [Op.iLike ? Op.iLike : Op.like]: `%${trimmedModel}%` };
        }

        // Search filter
        if (search && search.trim() !== '') {
            const trimmed = search.trim();
            whereClause[Op.or] = [
                { serial_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } },
                { model_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } }
            ];
        }

        // Date range
        if (startDate || endDate) {
            whereClause.scanned_at = {};
            if (startDate) {
                whereClause.scanned_at[Op.gte] = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            }
            if (endDate) {
                whereClause.scanned_at[Op.lte] = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            }
        }

        // SLA Status cutoff filter
        if (slaStatus && slaStatus !== 'ALL') {
            const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
            const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

            if (slaStatus === 'NORMAL') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: h24 };
            } else if (slaStatus === 'ATTENTION') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h24, [Op.gte]: h48 };
            } else if (slaStatus === 'WARNING') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h48, [Op.gte]: h72 };
            } else if (slaStatus === 'OVERDUE') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h72 };
            }
        }

        const allowedSort = ['scanned_at', 'birth_date', 'serial_number', 'model_number', 'pick_status'];
        const safeSortField = allowedSort.includes(sortField) ? sortField : 'scanned_at';
        const safeSortDir = sortDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const { count, rows } = await db.put.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: db.handling_unit,
                    attributes: ['id', 'hu_id', 'storage_status']
                },
                {
                    model: db.compartment,
                    attributes: ['id', 'compartment_number', 'status']
                }
            ],
            order: [[safeSortField, safeSortDir]],
            limit: pageSize,
            offset: offset
        });

        const items = rows.map(r => {
            const age = calculateAge(r.scanned_at, now);
            const birthAge = r.birth_date ? calculateAge(r.birth_date, now) : null;
            const sla = getKanbanSlaStatus(age.totalHours);

            return {
                id: r.id,
                serial_number: r.serial_number,
                model_number: r.model_number,
                process_status: r.process_status,
                pick_status: r.pick_status,
                pv_status: r.pv_status,
                scanned_at: r.scanned_at,
                birth_date: r.birth_date,
                scanned_by: r.scanned_by,
                hu_id: r.handling_unit?.hu_id || null,
                storage_status: r.handling_unit?.storage_status || null,
                compartment_number: r.compartment?.compartment_number || null,
                dwell_days: age.days,
                dwell_hours: age.hours,
                dwell_minutes: age.minutes,
                dwell_total_hours: age.totalHours,
                birth_age_days: birthAge ? birthAge.days : null,
                sla_status: sla
            };
        });

        return res.status(200).json({
            data: items,
            totalItems: count,
            totalPages: Math.ceil(count / pageSize),
            page: pageNum,
            size: pageSize
        });
    } catch (err) {
        console.error('getKanbanAgingList error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch kanban aging list.' });
    }
});

/**
 * POST /api/report/aging/export
 * Fetch all matching records (up to 10,000) for Excel export
 */
exports.getAgingExportData = asyncHandler(async (req, res) => {
    try {
        const {
            reportType = 'serial', // 'serial' or 'kanban'
            search = '',
            ageBucket = 'ALL',
            slaStatus = 'ALL',
            processStatus = 'ALL',
            pickStatus = 'ACTIVE',
            modelNumber = '',
            startDate = null,
            endDate = null,
            sortField = 'scanned_at',
            sortDirection = 'ASC'
        } = req.body || {};

        const now = new Date();
        const whereClause = {};

        // Pick status filter
        if (pickStatus === 'ACTIVE') {
            whereClause.pick_status = { [Op.in]: ['AVAILABLE', 'HOLD'] };
        } else if (pickStatus && pickStatus !== 'ALL') {
            whereClause.pick_status = pickStatus;
        }

        // Model Number filter (case-insensitive partial match)
        if (modelNumber && modelNumber.trim() !== '') {
            const trimmedModel = modelNumber.trim();
            whereClause.model_number = { [Op.iLike ? Op.iLike : Op.like]: `%${trimmedModel}%` };
        }

        // Search filter
        if (search && search.trim() !== '') {
            const trimmed = search.trim();
            whereClause[Op.or] = [
                { serial_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } },
                { model_number: { [Op.iLike ? Op.iLike : Op.like]: `%${trimmed}%` } }
            ];
        }

        // Date range
        if (startDate || endDate) {
            whereClause.scanned_at = {};
            if (startDate) {
                whereClause.scanned_at[Op.gte] = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            }
            if (endDate) {
                whereClause.scanned_at[Op.lte] = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            }
        }

        // Process Status filter
        if (processStatus === 'KANBAN_ONLY') {
            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };
        } else if (processStatus === 'KANBAN-IN') {
            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN'] };
        } else if (processStatus === 'KANBAN-RTN') {
            whereClause.process_status = { [Op.in]: ['KANBAN-RTN', 'KANBAN_RTN'] };
        } else if (processStatus === 'STANDARD_PUT') {
            whereClause.process_status = { [Op.notIn]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };
        }

        if (ageBucket && ageBucket !== 'ALL') {
            const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const d1 = h24;
            const d3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const d15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            const d120 = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

            if (ageBucket === '<24h' || ageBucket === '0-1') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: h24 };
            } else if (ageBucket === '1-3') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d1, [Op.gte]: d3 };
            } else if (ageBucket === '4-7') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d3, [Op.gte]: d7 };
            } else if (ageBucket === '0-7') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: d7 };
            } else if (ageBucket === '8-15') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d7, [Op.gte]: d15 };
            } else if (ageBucket === '16-30') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d15, [Op.gte]: d30 };
            } else if (ageBucket === '31-60') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d30, [Op.gte]: d60 };
            } else if (ageBucket === '61-120') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d60, [Op.gte]: d120 };
            } else if (ageBucket === '120+') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d120 };
            } else if (ageBucket === '60+') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d60 };
            } else if (ageBucket === '30+' || ageBucket === 'CRITICAL_30_PLUS') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: d30 };
            }
        }

        if (slaStatus && slaStatus !== 'ALL') {
            const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
            const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

            whereClause.process_status = { [Op.in]: ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-RTN', 'KANBAN_RTN'] };

            if (slaStatus === 'NORMAL') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.gte]: h24 };
            } else if (slaStatus === 'ATTENTION') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h24, [Op.gte]: h48 };
            } else if (slaStatus === 'WARNING') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h48, [Op.gte]: h72 };
            } else if (slaStatus === 'OVERDUE') {
                whereClause.scanned_at = { ...(whereClause.scanned_at || {}), [Op.lt]: h72 };
            }
        }

        const allowedSort = ['scanned_at', 'birth_date', 'serial_number', 'model_number', 'pick_status'];
        const safeSortField = allowedSort.includes(sortField) ? sortField : 'scanned_at';
        const safeSortDir = sortDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const orderClause = safeSortField === 'birth_date'
            ? [[safeSortField, `${safeSortDir} NULLS LAST`]]
            : [[safeSortField, safeSortDir]];

        const rows = await db.put.findAll({
            where: whereClause,
            include: [
                {
                    model: db.handling_unit,
                    attributes: ['hu_id', 'storage_status', 'bin_type_id'],
                    include: [{ model: db.bin_type, attributes: ['bin_name', 'name'] }]
                },
                {
                    model: db.compartment,
                    attributes: ['compartment_number', 'status']
                },
                {
                    model: db.files,
                    as: 'put_po_file',
                    attributes: ['name']
                },
                {
                    model: db.files,
                    as: 'put_text_file',
                    attributes: ['name']
                },
                {
                    model: db.pick,
                    attributes: ['id', 'scanned_at']
                }
            ],
            order: orderClause,
            limit: 10000
        });

        const items = rows.map(r => {
            const inDate = r.scanned_at || r.createdAt;
            const isPicked = r.pick_status === 'PICKED' || Boolean(r.pick_id);
            const pickTimestamp = isPicked ? (r.pick?.scanned_at || r.updatedAt || null) : null;
            const outDate = isPicked ? (pickTimestamp || now) : now;
            const inOutAge = calculateAge(inDate, outDate);
            const birthAge = r.birth_date ? calculateAge(r.birth_date, now) : null;
            const birthToInAge = (r.birth_date && r.scanned_at) ? calculateAge(r.birth_date, new Date(r.scanned_at)) : null;
            const bucket = getAgeBucket(inOutAge.days, inOutAge.totalHours);
            const isKanban = ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-OUT', 'KANBAN_OUT', 'KANBAN-RTN', 'KANBAN_RTN'].some(k =>
                r.process_status?.toUpperCase()?.includes(k)
            );
            const sla = isKanban ? getKanbanSlaStatus(inOutAge.totalHours) : null;

            return {
                id: r.id,
                serial_number: r.serial_number,
                model_number: r.model_number,
                hu_id: r.handling_unit?.hu_id || 'N/A',
                bin_type: r.handling_unit?.bin_type?.bin_name || r.handling_unit?.bin_type?.name || 'N/A',
                compartment_number: r.compartment?.compartment_number ?? 'N/A',
                compartment_status: r.compartment?.status || (r.compartment?.compartment_number ? 'OCCUPIED' : 'N/A'),
                storage_status: r.handling_unit?.storage_status || 'N/A',
                process_status: r.process_status || 'N/A',
                pick_status: r.pick_status,
                pv_status: r.pv_status || 'PASS',
                scanned_at: r.scanned_at,
                birth_date: r.birth_date || 'N/A',
                birth_to_in_days: birthToInAge ? birthToInAge.days : 'N/A',
                birth_to_in_formatted: birthToInAge ? `${birthToInAge.days}d ${birthToInAge.hours}h` : 'N/A',
                kanban_in_out_days: inOutAge.days,
                kanban_in_out_hours: inOutAge.hours,
                kanban_in_out_minutes: inOutAge.minutes,
                kanban_in_out_formatted: `${inOutAge.days}d ${inOutAge.hours}h ${inOutAge.minutes}m`,
                is_picked: isPicked ? 'YES' : 'NO',
                kardex_age_days: inOutAge.days,
                kardex_age_hours: inOutAge.hours,
                kardex_age_minutes: inOutAge.minutes,
                kardex_total_hours: inOutAge.totalHours,
                birth_age_days: birthAge ? birthAge.days : 'N/A',
                age_bucket: bucket,
                is_kanban: isKanban ? 'YES' : 'NO',
                kanban_dwell_hours: isKanban ? inOutAge.totalHours : 'N/A',
                kanban_dwell_days: isKanban ? inOutAge.days : 'N/A',
                kanban_sla_status: isKanban ? (sla || 'NORMAL') : 'N/A',
                scanned_by: r.scanned_by || 'SYSTEM',
                po_file_name: r.put_po_file?.name || 'N/A',
                kardex_file_name: r.put_text_file?.name || 'N/A',
                pick_id: r.pick?.id || 'N/A',
                pick_date: pickTimestamp,
                picked_at: pickTimestamp
            };
        });

        return res.status(200).json({ data: items, count: items.length });
    } catch (err) {
        console.error('getAgingExportData error:', err);
        return res.status(500).json({ error: err.message || 'Failed to export aging data.' });
    }
});

/**
 * GET /api/report/serial-audit/:serialNumber
 * Returns complete database record and audit history for a single serial number
 */
exports.getSerialAuditDetails = asyncHandler(async (req, res) => {
    try {
        const rawSerial = req.params.serialNumber;
        if (!rawSerial || rawSerial.trim() === '') {
            return res.status(400).json({ error: 'Serial number is required.' });
        }
        const serialNumber = decodeURIComponent(rawSerial).trim();
        const now = new Date();

        // 1. Find the latest put record for this serial number
        const put = await db.put.findOne({
            where: {
                serial_number: { [Op.iLike ? Op.iLike : Op.like]: serialNumber }
            },
            order: [['id', 'DESC']],
            include: [
                {
                    model: db.handling_unit,
                    include: [{ model: db.bin_type, required: false }]
                },
                {
                    model: db.compartment
                },
                {
                    model: db.pick,
                    include: [{ model: db.files, as: 'pick_text_file' }]
                },
                { model: db.files, as: 'put_text_file' },
                { model: db.files, as: 'put_po_file' }
            ]
        });

        // 2. Fetch all logs for this serial number (by entity_number or put_id)
        const logWhere = {
            [Op.or]: [
                { entity_number: serialNumber },
                ...(put?.id ? [{ put_id: put.id }] : []),
                ...(put?.pick_id ? [{ pick_id: put.pick_id }] : [])
            ]
        };

        const dialect = db.sequelize.getDialect();
        const uTable = dialect === 'postgres' ? '"user"' : 'user';
        const castText = dialect === 'postgres' ? '::TEXT' : '';

        const logs = await db.log.findAll({
            where: logWhere,
            order: [['log_date_time', 'ASC']],
            attributes: {
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by OR creator.user_id = log.logged_by)`
                        ),
                        'user_first_name'
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by OR creator.user_id = log.logged_by)`
                        ),
                        'user_last_name'
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} AS creator WHERE creator.id${castText} = log.logged_by OR creator.user_id = log.logged_by)`
                        ),
                        'operator_user_id'
                    ]
                ]
            }
        });

        // 3. Calculate exact aging metrics
        let aging = null;
        if (put) {
            const inDate = put.scanned_at || put.createdAt;
            const isPicked = put.pick_status === 'PICKED' || Boolean(put.pick_id);
            const outDate = isPicked ? (put.pick?.scanned_at || put.updatedAt || now) : now;
            const inOutAge = calculateAge(inDate, outDate);
            const kardexAge = calculateAge(put.scanned_at, now);
            const birthAge = put.birth_date ? calculateAge(put.birth_date, now) : null;
            const birthToInAge = (put.birth_date && put.scanned_at) ? calculateAge(put.birth_date, new Date(put.scanned_at)) : null;
            const isKanban = ['KANBAN-IN', 'KANBAN_IN', 'KANBAN-OUT', 'KANBAN_OUT', 'KANBAN-RTN', 'KANBAN_RTN'].some(k =>
                put.process_status?.toUpperCase()?.includes(k)
            );

            aging = {
                storage_age_days: inOutAge.days,
                storage_age_hours: inOutAge.hours,
                storage_age_minutes: inOutAge.minutes,
                storage_total_hours: inOutAge.totalHours,
                storage_formatted: `${inOutAge.days}d ${inOutAge.hours}h ${inOutAge.minutes}m`,
                birth_to_in_days: birthToInAge ? birthToInAge.days : null,
                birth_to_in_hours: birthToInAge ? birthToInAge.hours : null,
                birth_to_in_formatted: birthToInAge ? `${birthToInAge.days}d ${birthToInAge.hours}h` : 'N/A',
                kanban_in_out_days: inOutAge.days,
                kanban_in_out_hours: inOutAge.hours,
                kanban_in_out_minutes: inOutAge.minutes,
                kanban_in_out_formatted: `${inOutAge.days}d ${inOutAge.hours}h ${inOutAge.minutes}m`,
                is_picked: isPicked,
                in_date: inDate,
                out_date: isPicked ? outDate : null,
                birth_date: put.birth_date,
                birth_age_days: birthAge ? birthAge.days : null,
                is_kanban: isKanban,
                kanban_dwell_hours: isKanban ? inOutAge.totalHours : null,
                kanban_dwell_days: isKanban ? inOutAge.days : null,
                kanban_dwell_minutes: isKanban ? inOutAge.minutes : null
            };
        }

        return res.status(200).json({
            serialNumber,
            put: put || null,
            aging: aging || null,
            logs: logs || []
        });
    } catch (err) {
        console.error('getSerialAuditDetails error:', err);
        return res.status(500).json({ error: err.message || 'Failed to fetch serial audit details.' });
    }
});

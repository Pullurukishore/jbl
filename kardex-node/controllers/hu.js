const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const db = require('../models');
const { Op } = require('sequelize');
const uuid4 = require('uuid4');
const moment = require('moment');
const { getBoardHistory, getPVStatusCheck, getWipBySerialNumber, updateBoardHistory } = require('../utils/api-call');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: recalculate hu_status based on compartment states
// ─────────────────────────────────────────────────────────────────────────────
async function recalcHUStatus(huId) {
    const compartments = await db.compartment.findAll({ where: { handling_unit_id: huId } });
    if (!compartments || compartments.length === 0) {
        await db.handling_unit.update({ hu_status: 'EMPTY' }, { where: { id: huId } });
        return 'EMPTY';
    }
    const allEmpty = compartments.every(c => c.status === 'EMPTY');
    const allOccupied = compartments.every(c => c.status === 'OCCUPIED');
    let newStatus = 'PARTIALLY_FILLED';
    if (allEmpty) newStatus = 'EMPTY';
    else if (allOccupied) newStatus = 'FULL';
    await db.handling_unit.update({ hu_status: newStatus }, { where: { id: huId } });
    return newStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard include config for HU queries
// ─────────────────────────────────────────────────────────────────────────────
function huIncludes() {
    return [
        { model: db.bin_type },
        { model: db.compartment, order: [['compartment_number', 'ASC']] }
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────────────────────────────────────
exports.registerHU = asyncHandler(async (req, res) => {
    const { hu_id, bin_type_id } = req.body;
    if (!hu_id) {
        return res.status(400).json({ error: 'hu_id is required.' });
    }

    // Resolve bin specification (defaulting to fixed 30-compartment Kardex Type-C profile)
    let binType = null;
    if (bin_type_id) {
        binType = await db.bin_type.findByPk(bin_type_id);
    }
    if (!binType) {
        binType = await db.bin_type.findOne({ where: { compartment_count: 30 } });
    }
    if (!binType) {
        // Auto-create standard 30-compartment profile if it doesn't exist yet
        binType = await db.bin_type.create({
            name: 'Type-C (30 Compartments)',
            compartment_count: 30,
            bin_name: 'CON_BINC',
            description: 'Standard 30-compartment bin'
        });
    }

    const effectiveBinTypeId = binType.id;

    const existing = await db.handling_unit.findOne({ where: { hu_id } });
    if (existing && existing.storage_status !== 'DRAFT') {
        return res.status(409).json({ error: 'Bin already registered and cannot be re-registered.' });
    }

    let hu;
    if (existing && existing.storage_status === 'DRAFT') {
        // Unlink any put records referencing these compartments before destroying to prevent foreign key constraint violation
        const oldComps = await db.compartment.findAll({
            where: { handling_unit_id: existing.id },
            attributes: ['id']
        });
        const oldCompIds = oldComps.map(c => c.id);
        if (oldCompIds.length > 0) {
            await db.put.update(
                { compartment_id: null },
                { where: { compartment_id: { [Op.in]: oldCompIds } } }
            ).catch(() => {});
        }

        // Delete old compartments and re-register
        await db.compartment.destroy({ where: { handling_unit_id: existing.id } });
        await existing.update({
            bin_type_id: effectiveBinTypeId,
            hu_status: 'EMPTY',
            storage_status: 'DRAFT',
            last_transaction: null,
            transaction_status: null,
            registered_by: req.user?.user_id || 'SYSTEM'
        });
        hu = existing;
    } else {
        hu = await db.handling_unit.create({
            hu_id,
            bin_type_id: effectiveBinTypeId,
            hu_status: 'EMPTY',
            storage_status: 'DRAFT',
            registered_by: req.user?.user_id || 'SYSTEM'
        });
    }

    const compartmentRows = [];
    for (let i = 1; i <= binType.compartment_count; i++) {
        compartmentRows.push({ handling_unit_id: hu.id, compartment_number: i, status: 'EMPTY' });
    }
    await db.compartment.bulkCreate(compartmentRows);

    const result = await db.handling_unit.findByPk(hu.id, { include: huIncludes() });
    return res.status(201).json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:huId/layout
// ─────────────────────────────────────────────────────────────────────────────
exports.getLayout = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const hu = await db.handling_unit.findOne({
        where: { hu_id: huId },
        include: [
            { model: db.bin_type },
            {
                model: db.compartment,
                include: [{ model: db.put, required: false }]
            }
        ],
        order: [[db.compartment, 'compartment_number', 'ASC']]
    });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });
    return res.status(200).json(hu);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /draft
// ─────────────────────────────────────────────────────────────────────────────
exports.getDraftHUs = asyncHandler(async (req, res) => {
    const data = await db.handling_unit.findAll({
        where: { storage_status: { [Op.in]: ['DRAFT', 'OUTSIDE_KARDEX'] } },
        include: huIncludes()
    });
    return res.status(200).json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /in-kardex
// ─────────────────────────────────────────────────────────────────────────────
exports.getInKardexHUs = asyncHandler(async (req, res) => {
    const data = await db.handling_unit.findAll({
        where: { storage_status: 'IN_KARDEX' },
        include: huIncludes()
    });
    return res.status(200).json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /empty
// ─────────────────────────────────────────────────────────────────────────────
exports.getEmptyHUs = asyncHandler(async (req, res) => {
    const data = await db.handling_unit.findAll({
        where: { hu_status: 'EMPTY', storage_status: 'IN_KARDEX' },
        include: huIncludes()
    });
    return res.status(200).json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /partial
// ─────────────────────────────────────────────────────────────────────────────
exports.getPartialHUs = asyncHandler(async (req, res) => {
    const data = await db.handling_unit.findAll({
        where: { hu_status: 'PARTIALLY_FILLED', storage_status: 'IN_KARDEX' },
        include: huIncludes()
    });
    return res.status(200).json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /list  (paginated)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllHUs = asyncHandler(async (req, res) => {
    const { page = 1, size = 20, search = '', hu_status, storage_status } = req.body;
    const where = {};
    if (hu_status) where.hu_status = hu_status;
    if (storage_status) where.storage_status = storage_status;
    if (search && search.trim()) {
        const likeOp = Op.iLike || Op.like;
        where.hu_id = { [likeOp]: `%${search.trim()}%` };
    }

    const offset = (page - 1) * size;
    const limit = parseInt(size, 10);

    const [{ rows, count }, inKardexCount, draftCount, outsideKardexCount, emptyCount, partialCount, fullCount, totalAll] = await Promise.all([
        db.handling_unit.findAndCountAll({
            where,
            include: huIncludes(),
            order: [['id', 'DESC']],
            limit,
            offset
        }),
        db.handling_unit.count({ where: { storage_status: 'IN_KARDEX' } }).catch(() => 0),
        db.handling_unit.count({ where: { storage_status: 'DRAFT' } }).catch(() => 0),
        db.handling_unit.count({ where: { storage_status: 'OUTSIDE_KARDEX' } }).catch(() => 0),
        db.handling_unit.count({ where: { hu_status: 'EMPTY' } }).catch(() => 0),
        db.handling_unit.count({ where: { hu_status: 'PARTIALLY_FILLED' } }).catch(() => 0),
        db.handling_unit.count({ where: { hu_status: 'FULL' } }).catch(() => 0),
        db.handling_unit.count().catch(() => 0)
    ]);

    return res.status(200).json({
        data: rows,
        totalItems: count,
        totalPages: Math.ceil(count / size),
        page: parseInt(page, 10),
        stats: {
            total: totalAll,
            inKardex: inKardexCount,
            draft: draftCount,
            outsideKardex: outsideKardexCount,
            empty: emptyCount,
            partial: partialCount,
            full: fullCount
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:huId/compartment/:num/clear
// ─────────────────────────────────────────────────────────────────────────────
exports.clearCompartment = asyncHandler(async (req, res) => {
    const { huId, num } = req.params;
    const hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    const compartment = await db.compartment.findOne({
        where: { handling_unit_id: hu.id, compartment_number: parseInt(num, 10) }
    });
    if (!compartment) return res.status(404).json({ error: 'Compartment not found.' });
    if (compartment.status === 'EMPTY') return res.status(400).json({ error: 'Compartment is already empty.' });

    // Delete associated put record
    await db.put.destroy({ where: { compartment_id: compartment.id } });

    await compartment.update({
        status: 'EMPTY',
        serial_number: null,
        material_name: null,
        allocated_at: null,
        allocated_by: null
    });

    await recalcHUStatus(hu.id);

    return res.status(200).json(compartment);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:huId/scan/:compartmentNumber/:serialNumber  (SSE via browser EventSource)
// ─────────────────────────────────────────────────────────────────────────────
exports.scanCompartmentGet = asyncHandler(async (req, res) => {
    const { huId, compartmentNumber, serialNumber: serialNumberParam } = req.params;
    req.body = { compartment_number: compartmentNumber, serial_number: decodeURIComponent(serialNumberParam) };
    return exports.scanCompartment(req, res);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/scan  (SSE)
// ─────────────────────────────────────────────────────────────────────────────
exports.scanCompartment = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const { compartment_number, serial_number } = req.body;
    const process_id = uuid4();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const logScanEvent = async (payload) => {
        try {
            if (payload.status === 'FAILED' || (payload.activity === 'COMPLETE' && payload.status === 'SUCCESS')) {
                await db.log.create({
                    entity_number: payload.entity_number || serial_number || 'UNKNOWN',
                    activity: payload.activity || 'SCAN',
                    status: payload.status,
                    message: typeof payload.message === 'string' ? payload.message.slice(0, 250) : (payload.activity || ''),
                    logged_by: req.user?.user_id || req.user?.id || 'SYSTEM',
                    log_date_time: new Date(),
                    process_id,
                    log_type: 'PUT_PROCESS'
                });
            }
        } catch (_) {}
    };

    const sendEvent = (payload) => {
        res.write('data: ' + JSON.stringify({ process_id, ...payload }) + '\n\n');
        if (typeof res.flush === 'function') res.flush();
        logScanEvent(payload);
    };

    try {
        // ── 1. Validate inputs ────────────────────────────────────────────
        if (!compartment_number || !serial_number) {
            sendEvent({ activity: 'VALIDATE', status: 'FAILED', message: 'compartment_number and serial_number are required.' });
            return res.end();
        }
        const serialNumber = serial_number.trim();

        // ── 2. Find HU and compartment ────────────────────────────────────
        const hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
        if (!hu) {
            sendEvent({ activity: 'VALIDATE', status: 'FAILED', message: 'Handling unit not found.' });
            return res.end();
        }

        const compartment = await db.compartment.findOne({
            where: { handling_unit_id: hu.id, compartment_number: parseInt(compartment_number, 10) }
        });
        if (!compartment) {
            sendEvent({ activity: 'VALIDATE', status: 'FAILED', message: 'Compartment not found.' });
            return res.end();
        }
        if (compartment.status === 'OCCUPIED') {
            sendEvent({ activity: 'VALIDATE', status: 'FAILED', message: 'Compartment is already occupied.' });
            return res.end();
        }

        // ── 3. Check serial not already in another compartment ────────────
        const existingCompartment = await db.compartment.findOne({
            where: { serial_number: serialNumber, status: 'OCCUPIED' }
        });
        if (existingCompartment) {
            sendEvent({ activity: 'VALIDATE', status: 'FAILED', message: 'Serial number is already allocated to another compartment.' });
            return res.end();
        }

        const existingPut = await db.put.findOne({
            where: { serial_number: serialNumber },
            order: [['id', 'DESC']]
        });
        if (existingPut && existingPut.pick_status === 'AVAILABLE') {
            sendEvent({ activity: 'CHECK_STATUS', status: 'FAILED', message: 'Serial number is already available in Kardex storage.' });
            return res.end();
        }

        // ── 4. FETCH_DETAILS – Board History ──────────────────────────────
        sendEvent({ entity_number: serialNumber, activity: 'FETCH_DETAILS', status: 'IN_PROGRESS', message: 'Fetching board details & checking status...', completed: false });

        const boardHistoryResponse = await getBoardHistory(serialNumber);
        if (boardHistoryResponse?.isError) {
            sendEvent({ entity_number: serialNumber, activity: 'FETCH_DETAILS', status: 'FAILED', message: `Board History Api Failed. ${boardHistoryResponse?.error?.message ? `(${boardHistoryResponse?.error?.message})` : ''}` });
            return res.end();
        }

        const isKanbanIn = boardHistoryResponse.data.some(part =>
            ['KANBAN-IN', 'KANBAN_IN'].some(step => part.Test_Process?.toUpperCase()?.trim()?.includes(step))
        );
        const isKanbanOut = boardHistoryResponse.data.some(part =>
            ['KANBAN-OUT', 'KANBAN_OUT'].some(step => part.Test_Process?.toUpperCase()?.trim()?.includes(step))
        );

        if (isKanbanIn && !isKanbanOut) {
            sendEvent({ entity_number: serialNumber, activity: 'FETCH_DETAILS', status: 'FAILED', message: 'Only Kanban IN found, hence not allowed.' });
            return res.end();
        }

        let testProcess = process.env.KanbanInProcessStep || 'KANBAN-IN';
        if (isKanbanIn && isKanbanOut) {
            testProcess = process.env.KanbanRtnProcessStep || 'KANBAN-RTN';
        }

        const birthProcess = boardHistoryResponse.data.find(
            prt => prt?.Test_Process?.toUpperCase()?.trim() === 'BIRTH / BIRTH' || prt?.Test_Process?.toUpperCase()?.trim() === 'MTL_ASSEMBLY & LINKING / MTL_ASSEMBLY & LINKING'
        );
        if (!birthProcess) {
            sendEvent({ entity_number: serialNumber, activity: 'FETCH_DETAILS', status: 'FAILED', message: 'Birth Process not found in Board history response.' });
            return res.end();
        }

        const partBirth = new Date(birthProcess?.StartDateTime);
        let dtToChk = new Date();
        dtToChk.setFullYear(dtToChk.getFullYear() - 2);
        if (!partBirth || partBirth < dtToChk) {
            sendEvent({ entity_number: serialNumber, activity: 'FETCH_DETAILS', status: 'FAILED', message: 'Birth Time of serial number is 2 years old.' });
            return res.end();
        }

        sendEvent({ entity_number: serialNumber, activity: 'FETCH_DETAILS', status: 'SUCCESS', completed: true });

        // ── 5. CHECK_STATUS – PV Status ───────────────────────────────────
        sendEvent({ entity_number: serialNumber, activity: 'CHECK_STATUS', status: 'IN_PROGRESS', message: 'Checking PV status...', completed: false });

        const pvStatusResponse = await getPVStatusCheck(serialNumber, testProcess);
        if (pvStatusResponse?.isError) {
            sendEvent({ entity_number: serialNumber, activity: 'CHECK_STATUS', status: 'FAILED', message: `PV Status Api Failed. ${pvStatusResponse?.error?.message ? `(${pvStatusResponse?.error?.message})` : ''}` });
            return res.end();
        }

        const pvStatus = pvStatusResponse === 'PASS' ? 'PASS' : 'FAIL';

        if (pvStatusResponse !== 'PASS') {
            sendEvent({ entity_number: serialNumber, activity: 'CHECK_STATUS', status: 'FAILED', message: `PV Status check failed: ${pvStatusResponse}` });
            return res.end();
        }

        sendEvent({ entity_number: serialNumber, activity: 'CHECK_STATUS', status: 'SUCCESS', completed: true });

        // ── 6. FIND_MODEL – WIP lookup ────────────────────────────────────
        sendEvent({ entity_number: serialNumber, activity: 'FIND_MODEL', status: 'IN_PROGRESS', message: 'Fetching model number from MES...', completed: false });

        const wipResponse = await getWipBySerialNumber(serialNumber);
        if (wipResponse?.isError) {
            sendEvent({ entity_number: serialNumber, activity: 'FIND_MODEL', status: 'FAILED', message: `Get WIP By Serial Api Failed. ${wipResponse?.error?.message ? `(${wipResponse?.error?.message})` : ''}` });
            return res.end();
        }

        const isOnHold = wipResponse.data?.CurrentlyOnHold;
        if (isOnHold) {
            sendEvent({ entity_number: serialNumber, activity: 'FIND_MODEL', status: 'FAILED', message: 'Serial Number is On Hold.' });
            return res.end();
        }

        const modelNumber = wipResponse.data?.Part_Number
            || wipResponse.data?.PartNumber
            || wipResponse.data?.MaterialName
            || birthProcess?.Number
            || serialNumber;

        sendEvent({ entity_number: serialNumber, activity: 'FIND_MODEL', status: 'SUCCESS', model_number: modelNumber, completed: true });

        // ── 7. ALLOCATE ───────────────────────────────────────────────────
        sendEvent({ entity_number: serialNumber, activity: 'ALLOCATE', status: 'IN_PROGRESS', message: 'Allocating compartment...', completed: false });

        await compartment.update({
            status: 'OCCUPIED',
            serial_number: serialNumber,
            material_name: modelNumber,
            allocated_at: new Date(),
            allocated_by: req.user?.user_id || 'SYSTEM'
        });

        const putRecord = await db.put.create({
            serial_number: serialNumber,
            birth_date: birthProcess?.StartDateTime ? new Date(birthProcess.StartDateTime) : null,
            pv_status: pvStatus,
            process_status: testProcess,
            model_number: modelNumber,
            pick_status: 'AVAILABLE',
            scanned_by: req.user?.user_id || 'SYSTEM',
            handling_unit_id: hu.id,
            compartment_id: compartment.id
        });

        const newHuStatus = await recalcHUStatus(hu.id);

        const updatedCompartment = await db.compartment.findByPk(compartment.id);

        // ── 8. COMPLETE ───────────────────────────────────────────────────
        sendEvent({
            entity_number: serialNumber,
            activity: 'COMPLETE',
            status: 'SUCCESS',
            message: 'Compartment allocated successfully.',
            completed: true,
            compartment: updatedCompartment,
            put: putRecord,
            hu_status: newHuStatus
        });

        return res.end();
    } catch (err) {
        try {
            res.write('data: ' + JSON.stringify({ process_id, activity: 'ERROR', status: 'FAILED', message: err?.message || String(err) }) + '\n\n');
        } catch (_) { }
        return res.end();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/send-to-kardex
// ─────────────────────────────────────────────────────────────────────────────
exports.sendToKardex = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const hu = await db.handling_unit.findOne({
        where: { hu_id: huId },
        include: [
            { model: db.bin_type },
            { model: db.compartment, where: { status: 'OCCUPIED' }, required: false }
        ]
    });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    const occupiedCompartments = (hu.compartments || [])
        .filter(c => c.status === 'OCCUPIED')
        .sort((a, b) => a.compartment_number - b.compartment_number);
    if (occupiedCompartments.length === 0) {
        return res.status(400).json({ error: 'No occupied compartments. Cannot send empty HU to Kardex.' });
    }

    // Sequence number for this bin PUT order batch (starts at 1, 2, 3...)
    const nextSeq = (hu.put_order_seq || 0) + 1;
    const orderNumber = `${hu.hu_id}-PUT-${nextSeq}`;

    // Build file content: all rows in this PUT batch share the same order number (<BIN>-PUT-1)
    const lines = occupiedCompartments.map((c) => {
        return `${orderNumber}|${hu.hu_id}@${c.compartment_number}|${c.material_name || ''}|1|${hu.bin_type ? hu.bin_type.bin_name : ''}|${c.serial_number || ''}`;
    });
    const fileContent = lines.join('\r\n');
    const timestamp = Date.now();
    const fileName = `PUT_${hu.hu_id}_${nextSeq}_${timestamp}.txt`;
    const dirPath = process.env.Put_Text_File_Path || path.join('uploads', 'files', 'put');
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, fileContent, 'ascii');

    // Also save a local copy in uploads
    const uploadDir = path.join('uploads', 'files', 'put');
    fs.mkdirSync(uploadDir, { recursive: true });
    const uploadFilePath = path.join(uploadDir, fileName);
    if (path.resolve(filePath) !== path.resolve(uploadFilePath)) {
        fs.writeFileSync(uploadFilePath, fileContent, 'ascii');
    }
    const fileStats = fs.statSync(uploadFilePath);

    const fileRecord = await db.files.create({
        name: fileName,
        size: fileStats.size,
        type: 'text/plain',
        path: uploadFilePath,
        created_by: req.user?.user_id || 'SYSTEM',
        updated_by: req.user?.user_id || 'SYSTEM'
    });

    await hu.update({
        storage_status: 'IN_KARDEX',
        transaction_status: 'SUCCESSFUL',
        last_transaction: 'PUT',
        put_order_seq: nextSeq
    });

    // Update all associated put records for this HU
    const compartmentIds = occupiedCompartments.map(c => c.id);
    if (compartmentIds.length > 0) {
        await db.put.update(
            { text_file_downloaded: false, text_file_id: fileRecord.id },
            { where: { compartment_id: { [Op.in]: compartmentIds } } }
        );
    }

    return res.status(200).json({
        message: 'HU sent to Kardex successfully.',
        orderNumber,
        orderRange: orderNumber,
        file: { name: fileName, path: uploadFilePath, id: fileRecord.id },
        lineCount: lines.length
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/confirm-put
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmPut = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const { status } = req.body;
    if (!['SUCCESSFUL', 'FAILED'].includes(status)) {
        return res.status(400).json({ error: 'status must be SUCCESSFUL or FAILED.' });
    }
    const hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    const updateData = { transaction_status: status };
    if (status === 'FAILED') {
        updateData.storage_status = 'DRAFT';
    }
    await hu.update(updateData);
    return res.status(200).json(hu);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/hu-pick
// ─────────────────────────────────────────────────────────────────────────────
exports.generateHUPick = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const hu = await db.handling_unit.findOne({
        where: { hu_id: huId },
        include: [{ model: db.bin_type }]
    });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });
    if (hu.storage_status !== 'IN_KARDEX') {
        return res.status(400).json({ error: 'HU is not currently in Kardex. Cannot generate HU pick.' });
    }

    const fileContent = `${hu.hu_id}|${hu.hu_id}|5|1`;
    const timestamp = Date.now();
    const fileName = `HU_PICK_${hu.hu_id}_${timestamp}.txt`;
    const dirPath = process.env.Pick_Text_File_Path || path.join('uploads', 'files', 'pick');
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, fileContent, 'ascii');

    const uploadDir = path.join('uploads', 'files', 'pick');
    fs.mkdirSync(uploadDir, { recursive: true });
    const uploadFilePath = path.join(uploadDir, fileName);
    if (path.resolve(filePath) !== path.resolve(uploadFilePath)) {
        fs.writeFileSync(uploadFilePath, fileContent, 'ascii');
    }
    const fileStats = fs.statSync(uploadFilePath);

    const fileRecord = await db.files.create({
        name: fileName,
        size: fileStats.size,
        type: 'text/plain',
        path: uploadFilePath,
        created_by: req.user?.user_id || 'SYSTEM',
        updated_by: req.user?.user_id || 'SYSTEM'
    });

    await hu.update({
        storage_status: 'OUTSIDE_KARDEX',
        transaction_status: 'PENDING',
        last_transaction: 'HU_PICK'
    });

    return res.status(200).json({
        message: 'HU pick file generated successfully.',
        file: { name: fileName, path: uploadFilePath, id: fileRecord.id }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/confirm-retrieval
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmRetrieval = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const { status } = req.body;
    if (!['SUCCESSFUL', 'FAILED'].includes(status)) {
        return res.status(400).json({ error: 'status must be SUCCESSFUL or FAILED.' });
    }
    const hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    const updateData = { transaction_status: status };
    if (status === 'SUCCESSFUL') {
        updateData.storage_status = 'OUTSIDE_KARDEX';
        updateData.last_transaction = 'HU_PICK';
    } else if (status === 'FAILED') {
        updateData.storage_status = 'IN_KARDEX';
    }
    await hu.update(updateData);
    return res.status(200).json(hu);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /bin-types
// ─────────────────────────────────────────────────────────────────────────────
exports.getBinTypes = asyncHandler(async (req, res) => {
    const data = await db.bin_type.findAll({ order: [['id', 'ASC']] });
    return res.status(200).json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /bin-types
// ─────────────────────────────────────────────────────────────────────────────
exports.createBinType = asyncHandler(async (req, res) => {
    const { name, compartment_count, bin_name, description } = req.body;
    if (!name || !compartment_count || !bin_name) {
        return res.status(400).json({ error: 'name, compartment_count, and bin_name are required.' });
    }
    const binType = await db.bin_type.create({ name, compartment_count, bin_name, description });
    return res.status(201).json(binType);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /bin-types/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.updateBinType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const binType = await db.bin_type.findByPk(id);
    if (!binType) return res.status(404).json({ error: 'Bin type not found.' });
    const { name, compartment_count, bin_name, description } = req.body;
    await binType.update({ name, compartment_count, bin_name, description });
    return res.status(200).json(binType);
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /bin-types/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteBinType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const binType = await db.bin_type.findByPk(id);
    if (!binType) return res.status(404).json({ error: 'Bin type not found.' });
    await binType.destroy();
    return res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /confirm-material-pick
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmMaterialPick = asyncHandler(async (req, res) => {
    const { pick_id } = req.body;
    if (!pick_id) return res.status(400).json({ error: 'pick_id is required.' });

    const pick = await db.pick.findByPk(pick_id);
    if (!pick) return res.status(404).json({ error: 'Pick not found.' });

    const puts = await db.put.findAll({ where: { pick_id } });
    const affectedHUIds = new Set();

    for (const putRecord of puts) {
        if (putRecord.compartment_id) {
            const compartment = await db.compartment.findByPk(putRecord.compartment_id);
            if (compartment) {
                await compartment.update({
                    status: 'EMPTY',
                    serial_number: null,
                    material_name: null,
                    allocated_at: null,
                    allocated_by: null
                });
                if (compartment.handling_unit_id) {
                    affectedHUIds.add(compartment.handling_unit_id);
                }
            }
        }
    }

    // Recalculate hu_status for all affected HUs
    for (const huId of affectedHUIds) {
        await recalcHUStatus(huId);
    }

    await pick.update({ updated_at: new Date() });

    return res.status(200).json({ message: 'Material pick confirmed. Compartments cleared.', cleared: puts.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/compartment/:num/pick
// ─────────────────────────────────────────────────────────────────────────────
exports.pickCompartment = asyncHandler(async (req, res) => {
    const { huId, num } = req.params;
    const hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    const compartment = await db.compartment.findOne({
        where: { handling_unit_id: hu.id, compartment_number: parseInt(num, 10) }
    });
    if (!compartment) return res.status(404).json({ error: 'Compartment not found.' });
    if (compartment.status === 'EMPTY') return res.status(400).json({ error: 'Compartment is already empty.' });

    const serialNumber = compartment.serial_number;
    const pickProcessStep = process.env.KanbanOutProcessStep || 'KANBAN-OUT';

    const putRecord = await db.put.findOne({ where: { compartment_id: compartment.id } });
    const modelNumber = putRecord?.model_number || compartment.material_name || 'MODEL';

    // Update MES board history if serial exists
    if (serialNumber) {
        try {
            await updateBoardHistory({
                serialNumber,
                processName: pickProcessStep,
                userId: req.user?.user_id || 'SYSTEM',
                startTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                result: 'P'
            });
        } catch (_) {}
    }

    // Generate Kardex Pick Order File for this specific serial
    const existingPickCount = await db.files.count({
        where: { name: { [Op.like]: `PICK_${modelNumber}_%` } }
    });
    const pickSeq = String(existingPickCount + 1).padStart(2, '0');
    const pickOrderNumber = `${modelNumber}-PICK-${pickSeq}`;
    const genFileName = `PICK_${modelNumber}_${pickSeq}_${Date.now()}.txt`;
    const dirPath = process.env.Pick_Text_File_Path || path.join('uploads', 'files', 'pick');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, genFileName);
    const uploadDir = path.join('uploads', 'files', 'pick');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const uploadFilePath = path.join(uploadDir, genFileName);
    const content = `${pickOrderNumber}|${serialNumber}|${modelNumber}|1`;

    fs.writeFileSync(filePath, content, 'ascii');
    fs.writeFileSync(uploadFilePath, content, 'ascii');
    const fileStats = fs.statSync(uploadFilePath);

    const newFile = await db.files.create({
        name: genFileName,
        size: fileStats.size,
        type: 'text/plain',
        path: uploadFilePath,
        created_by: req.user?.id,
        updated_by: req.user?.id
    });

    const savedPickEntry = await db.pick.create({
        model_number: modelNumber,
        quantity: 1,
        process_status: pickProcessStep,
        entered_by: req.user?.id,
        text_file_id: newFile.id
    });

    if (putRecord) {
        await savedPickEntry.setPuts([putRecord]);
    }

    // Update put record to PICKED
    await db.put.update(
        {
            pick_status: 'PICKED',
            process_status: pickProcessStep,
            compartment_id: null,
            pick_id: savedPickEntry.id,
            text_file_id: newFile.id
        },
        { where: { compartment_id: compartment.id } }
    );

    await compartment.update({
        status: 'EMPTY',
        serial_number: null,
        material_name: null,
        allocated_at: null,
        allocated_by: null
    });

    const newHuStatus = await recalcHUStatus(hu.id);

    return res.status(200).json({
        message: `Serial ${serialNumber} picked successfully from compartment #${num}. File ${genFileName} generated.`,
        compartment,
        hu_status: newHuStatus,
        fileName: genFileName,
        pickId: savedPickEntry.id
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/pick-all
// ─────────────────────────────────────────────────────────────────────────────
exports.pickAllCompartments = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const hu = await db.handling_unit.findOne({
        where: { hu_id: huId },
        include: [{ model: db.compartment }]
    });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    const occupiedCompartments = (hu.compartments || []).filter(c => c.status === 'OCCUPIED');
    if (occupiedCompartments.length === 0) {
        return res.status(400).json({ error: 'No parts to pick in this handling unit.' });
    }

    const pickProcessStep = process.env.KanbanOutProcessStep || 'KANBAN-OUT';
    const compIds = occupiedCompartments.map(c => c.id);

    // Update MES board history for all serials
    for (const comp of occupiedCompartments) {
        if (comp.serial_number) {
            try {
                await updateBoardHistory({
                    serialNumber: comp.serial_number,
                    processName: pickProcessStep,
                    userId: req.user?.user_id || 'SYSTEM',
                    startTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                    endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                    result: 'P'
                });
            } catch (_) {}
        }
    }

    // Update put records
    await db.put.update(
        { pick_status: 'PICKED', process_status: pickProcessStep, compartment_id: null },
        { where: { compartment_id: { [Op.in]: compIds } } }
    );

    // Empty all compartments
    await db.compartment.update({
        status: 'EMPTY',
        serial_number: null,
        material_name: null,
        allocated_at: null,
        allocated_by: null
    }, {
        where: { id: { [Op.in]: compIds } }
    });

    await hu.update({ hu_status: 'EMPTY' });

    return res.status(200).json({
        message: `Successfully picked and unloaded all ${occupiedCompartments.length} parts from ${hu.hu_id}.`,
        pickedCount: occupiedCompartments.length
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:huId/pick-scan/:serialNumber (SSE)
// Supports one-by-one scanning and validation during pick
// ─────────────────────────────────────────────────────────────────────────────
exports.pickScanGet = asyncHandler(async (req, res) => {
    const { huId, serialNumber: serialNumberParam } = req.params;
    const compartmentNumber = req.query?.compartment_number;
    const serial_number = decodeURIComponent(serialNumberParam || '').trim();
    const process_id = uuid4();
    const startTime = moment().format('MM/DD/YYYY hh:mm:ss A');
    const pickProcessStep = process.env.KanbanOutProcessStep || 'KANBAN-OUT';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (payload) => {
        res.write('data: ' + JSON.stringify({ process_id, entity_number: serial_number, ...payload }) + '\n\n');
        if (typeof res.flush === 'function') res.flush();
    };

    try {
        if (!serial_number) {
            sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: 'Serial number is required.' });
            return res.end();
        }

        const hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
        if (!hu) {
            sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: `Handling unit ${huId} not found.` });
            return res.end();
        }

        // Find compartment by compartmentNumber or by serialNumber
        let compartment = null;
        if (compartmentNumber) {
            compartment = await db.compartment.findOne({
                where: { handling_unit_id: hu.id, compartment_number: parseInt(compartmentNumber, 10) }
            });
            if (!compartment) {
                sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: `Compartment #${compartmentNumber} not found in this bin.` });
                return res.end();
            }
            if (compartment.status !== 'OCCUPIED') {
                sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: `Compartment #${compartmentNumber} is already EMPTY.` });
                return res.end();
            }
            if (compartment.serial_number && compartment.serial_number.toLowerCase() !== serial_number.toLowerCase()) {
                sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: `Scanned serial ${serial_number} does not match serial seated in compartment #${compartmentNumber} (${compartment.serial_number}).` });
                return res.end();
            }
        } else {
            compartment = await db.compartment.findOne({
                where: {
                    handling_unit_id: hu.id,
                    serial_number: serial_number,
                    status: 'OCCUPIED'
                }
            });
            if (!compartment) {
                sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: `Serial ${serial_number} not found in any occupied compartment of this bin.` });
                return res.end();
            }
        }

        // Step 1: FETCH_DETAILS (Verify Board in MES)
        sendEvent({ activity: 'FETCH_DETAILS', status: 'IN_PROGRESS', message: `Verifying board history for serial ${serial_number}...`, completed: false });
        const boardHistoryResponse = await getBoardHistory(serial_number);
        if (boardHistoryResponse?.isError) {
            sendEvent({ activity: 'FETCH_DETAILS', status: 'FAILED', message: `Board History API Failed. ${boardHistoryResponse?.error?.message ? `(${boardHistoryResponse?.error?.message})` : ''}` });
            return res.end();
        }
        sendEvent({ activity: 'FETCH_DETAILS', status: 'SUCCESS', message: `Board history verified in MES.`, completed: true });

        // Step 2: CHECK_STATUS (PV Status Check for KANBAN-OUT)
        sendEvent({ activity: 'CHECK_STATUS', status: 'IN_PROGRESS', message: `Checking PV status for ${pickProcessStep}...`, completed: false });
        const pvStatusResponse = await getPVStatusCheck(serial_number, pickProcessStep);
        if (pvStatusResponse?.isError) {
            sendEvent({ activity: 'CHECK_STATUS', status: 'FAILED', message: `PV Status API Failed: ${pvStatusResponse?.error?.message || ''}` });
            return res.end();
        }
        if (pvStatusResponse !== 'PASS') {
            sendEvent({ activity: 'CHECK_STATUS', status: 'FAILED', message: `PV Status check failed: ${pvStatusResponse}` });
            return res.end();
        }
        sendEvent({ activity: 'CHECK_STATUS', status: 'SUCCESS', message: `PV Status check PASSED.`, completed: true });

        // Step 3: PASS_FAIL (MES WIP Hold Status)
        sendEvent({ activity: 'PASS_FAIL', status: 'IN_PROGRESS', message: `Checking MES WIP Hold status...`, completed: false });
        const wipResponse = await getWipBySerialNumber(serial_number);
        if (wipResponse?.isError) {
            sendEvent({ activity: 'PASS_FAIL', status: 'FAILED', message: `WIP API Failed: ${wipResponse?.error?.message || ''}` });
            return res.end();
        }
        if (wipResponse.data?.CurrentlyOnHold) {
            sendEvent({ activity: 'PASS_FAIL', status: 'FAILED', message: `Serial ${serial_number} is currently ON HOLD in MES.` });
            return res.end();
        }
        const modelNumber = wipResponse.data?.Part_Number || wipResponse.data?.PartNumber || compartment.material_name || serial_number;
        sendEvent({ activity: 'PASS_FAIL', status: 'SUCCESS', message: `WIP Hold check PASSED. Model: ${modelNumber}`, completed: true });

        // Step 4: FILE_GENERATED (Update MES Kanban & Pick from Bin)
        sendEvent({ activity: 'FILE_GENERATED', status: 'IN_PROGRESS', message: `Updating MES Kanban board history to ${pickProcessStep}...`, completed: false });
        const updateResponse = await updateBoardHistory({
            serialNumber: serial_number,
            processName: pickProcessStep,
            userId: req.user?.user_id || 'SYSTEM',
            startTime: startTime,
            endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
            result: 'P'
        });
        if (updateResponse?.isError) {
            sendEvent({ activity: 'FILE_GENERATED', status: 'FAILED', message: `Failed to update MES Kanban history: ${updateResponse?.error?.message || ''}` });
            return res.end();
        }

        // Calculate 2-digit sequential order run for this model (e.g. SFG001970-PICK-01, SFG001970-PICK-02...)
        const existingPickCount = await db.files.count({
            where: {
                name: { [Op.like]: `PICK_${modelNumber}_%` }
            }
        });
        const pickSeq = String(existingPickCount + 1).padStart(2, '0');
        const pickOrderNumber = `${modelNumber}-PICK-${pickSeq}`;

        // Generate Kardex pick order text file in model-centric format: <MODEL>-PICK-<01>|serial|model|1
        const genFileName = `PICK_${modelNumber}_${pickSeq}_${Date.now()}.txt`;
        const dirPath = process.env.Pick_Text_File_Path || path.join('uploads', 'files', 'pick');
        fs.mkdirSync(dirPath, { recursive: true });
        const filePath = path.join(dirPath, genFileName);
        const fileContent = `${pickOrderNumber}|${serial_number}|${modelNumber}|1`;
        fs.writeFileSync(filePath, fileContent, 'ascii');

        const uploadDir = path.join('uploads', 'files', 'pick');
        fs.mkdirSync(uploadDir, { recursive: true });
        const uploadFilePath = path.join(uploadDir, genFileName);
        if (path.resolve(filePath) !== path.resolve(uploadFilePath)) {
            fs.writeFileSync(uploadFilePath, fileContent, 'ascii');
        }
        const fileStats = fs.statSync(uploadFilePath);

        const newFile = await db.files.create({
            name: genFileName,
            size: fileStats.size,
            type: 'text/plain',
            path: uploadFilePath,
            created_by: req.user?.id,
            updated_by: req.user?.id
        });

        // Update put record to PICKED
        await db.put.update(
            { pick_status: 'PICKED', process_status: pickProcessStep },
            { where: { compartment_id: compartment.id } }
        );

        const compNumber = compartment.compartment_number;

        // Preserve serial_number and material_name so the UI and Kardex pick order show the PICKED parts
        await compartment.update({
            status: 'EMPTY',
            serial_number: serial_number,
            material_name: modelNumber,
            allocated_at: new Date(),
            allocated_by: req.user?.id || 'SYSTEM'
        });

        const newHuStatus = await recalcHUStatus(hu.id);
        const remainingOccupied = await db.compartment.count({
            where: { handling_unit_id: hu.id, status: 'OCCUPIED' }
        });

        // Log transaction
        await db.log.create({
            entity_number: serial_number,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: `Serial ${serial_number} picked from compartment #${compNumber} of Bin ${hu.hu_id}.`,
            log_type: 'PICK_PROCESS',
            process_id
        }).catch(() => {});

        sendEvent({
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: `Serial ${serial_number} successfully validated & picked from compartment #${compNumber}.`,
            completed: true,
            compartment_number: compNumber,
            serial_number,
            model_number: modelNumber,
            remaining_occupied: remainingOccupied,
            hu_status: newHuStatus,
            all_empty: remainingOccupied === 0
        });

        return res.end();
    } catch (err) {
        sendEvent({
            activity: 'FILE_GENERATED',
            status: 'FAILED',
            message: err?.message || String(err)
        });
        return res.end();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:huId/send-pick-to-kardex
// Generates Kardex pick file for all picked parts in this HU and finalizes them
// ─────────────────────────────────────────────────────────────────────────────
exports.sendPickToKardex = asyncHandler(async (req, res) => {
    const { huId } = req.params;
    const hu = await db.handling_unit.findOne({
        where: { hu_id: huId },
        include: [{ model: db.bin_type }]
    });
    if (!hu) return res.status(404).json({ error: 'Handling unit not found.' });

    // Find all picked puts for this HU
    const pickedPuts = await db.put.findAll({
        where: {
            handling_unit_id: hu.id,
            pick_status: 'PICKED'
        }
    });

    if (!pickedPuts || pickedPuts.length === 0) {
        return res.status(400).json({ error: 'No picked parts found in this Handling Unit to send to Kardex.' });
    }

    // Build Kardex Pick Order content: <MODEL>-PICK-<01>|serial|model|1
    // Keep consistent order number per model in the HU batch so all items share the single pick order
    const modelOrderMap = new Map();
    const lines = [];
    for (const pt of pickedPuts) {
        const mNum = pt.model_number || 'MODEL';
        if (!modelOrderMap.has(mNum)) {
            const existingPickCount = await db.files.count({
                where: {
                    name: { [Op.like]: `PICK_${mNum}_%` }
                }
            });
            const pickSeq = String(existingPickCount + 1).padStart(2, '0');
            modelOrderMap.set(mNum, `${mNum}-PICK-${pickSeq}`);
        }
        const pickOrderNumber = modelOrderMap.get(mNum);
        lines.push(`${pickOrderNumber}|${pt.serial_number}|${mNum}|1`);
    }
    const fileContent = lines.join('\r\n');
    const timestamp = Date.now();
    const fileName = `KARDEX_PICK_${hu.hu_id}_${timestamp}.txt`;
    const dirPath = process.env.Pick_Text_File_Path || path.join('uploads', 'files', 'pick');
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, fileContent, 'ascii');

    const uploadDir = path.join('uploads', 'files', 'pick');
    fs.mkdirSync(uploadDir, { recursive: true });
    const uploadFilePath = path.join(uploadDir, fileName);
    if (path.resolve(filePath) !== path.resolve(uploadFilePath)) {
        fs.writeFileSync(uploadFilePath, fileContent, 'ascii');
    }
    const fileStats = fs.statSync(uploadFilePath);

    const fileRecord = await db.files.create({
        name: fileName,
        size: fileStats.size,
        type: 'text/plain',
        path: uploadFilePath,
        created_by: req.user?.id || 'SYSTEM',
        updated_by: req.user?.id || 'SYSTEM'
    });

    // Mark puts as downloaded with this file AND unlink compartment_id so compartment is completely free
    const putIds = pickedPuts.map(p => p.id);
    await db.put.update(
        { text_file_downloaded: true, text_file_id: fileRecord.id, compartment_id: null },
        { where: { id: putIds } }
    );

    // Finalize the picked compartments by clearing serials now that Kardex file is generated
    const compIds = pickedPuts.map(p => p.compartment_id).filter(Boolean);
    const pickedSerials = pickedPuts.map(p => p.serial_number).filter(Boolean);
    const compConditions = [];
    if (compIds.length > 0) compConditions.push({ id: { [Op.in]: compIds } });
    if (pickedSerials.length > 0) compConditions.push({ handling_unit_id: hu.id, serial_number: { [Op.in]: pickedSerials } });

    if (compConditions.length > 0) {
        await db.compartment.update({
            status: 'EMPTY',
            serial_number: null,
            material_name: null,
            allocated_at: null,
            allocated_by: null
        }, {
            where: { [Op.or]: compConditions }
        });
    }

    await recalcHUStatus(hu.id);

    return res.status(200).json({
        message: `Successfully generated Kardex Pick Order file for ${pickedPuts.length} part(s).`,
        fileName,
        lineCount: pickedPuts.length,
        fileId: fileRecord.id
    });
});

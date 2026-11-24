const asyncHandler = require('express-async-handler');
const db = require('../models');
const fs = require("fs");
const uuid4 = require('uuid4');
const path = require('path');
const { Op } = require('sequelize');
const { getPVStatusCheck, getWipBySerialNumber, updateBoardHistory } = require('../utils/api-call');
const moment = require('moment');
const { safeOrder } = require('../utils/sqlSecurity');

function safeWriteSSE(res, data) {
    if (res && !res.writableEnded && !res.destroyed) {
        try {
            res.write("data: " + JSON.stringify(data) + "\n\n");
            if (typeof res.flush === 'function') res.flush();
        } catch (_) {}
    }
}


exports.createPick = asyncHandler(async (req, res) => {
    const startTime = moment().format('MM/DD/YYYY hh:mm:ss A');
    const progressTimeline = ['FETCH_DETAILS', 'CHECK_QTY', 'CHECK_STATUS', 'FILE_GENERATED'];
    let activeProgressStep = 0;
    const process_id = uuid4();
    const { modelNumber: rawModelParam, qty } = req.params;
    const quantity = Number(qty);
    const pickProcessStep = process.env.KanbanOutProcessStep || 'KANBAN-OUT';
    const serialsQuery = req.query?.serials; // optional comma-separated list of manually scanned serials
    const logs = [];

    const rawInput = decodeURIComponent(rawModelParam || '').trim();

    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // 1. Resolve Model Number if a Serial Number was scanned instead
        let resolvedModelNumber = rawInput;
        let seedSerial = null;
        const matchedSerial = await db.put.findOne({
            where: { serial_number: rawInput }
        });
        if (matchedSerial && matchedSerial.model_number) {
            resolvedModelNumber = matchedSerial.model_number;
            seedSerial = rawInput;
        }

        // Immediate initial progress event to establish live SSE connection without lag
        safeWriteSSE(res, {
            entity_number: resolvedModelNumber,
            activity: 'FETCH_DETAILS',
            status: 'IN_PROGRESS',
            message: `Fetching available stock for model ${resolvedModelNumber} (Target: ${quantity} units)...`,
            completed: false,
            process_id
        });

        if (!quantity || isNaN(quantity) || quantity <= 0) {
            logs.push(await createAndSendLog({
                entity_number: resolvedModelNumber,
                activity: 'CHECK_QTY',
                status: 'FAILED',
                message: `Invalid quantity requested (${quantity}). Quantity must be at least 1.`,
                logged_by: req.user?.id,
                log_type: 'PICK_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        const maxPickLimit = parseInt(process.env.MAX_PICK_QUANTITY, 10) || 500;
        if (quantity > maxPickLimit) {
            logs.push(await createAndSendLog({
                entity_number: resolvedModelNumber,
                activity: 'CHECK_QTY',
                status: 'FAILED',
                message: `Requested quantity (${quantity}) exceeds maximum safety limit of ${maxPickLimit}.`,
                logged_by: req.user?.id,
                log_type: 'PICK_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        let candidates = [];

        if (serialsQuery) {
            // Mode B: Manual Specific Serials list
            const manualSerialList = serialsQuery.split(',').map(s => decodeURIComponent(s).trim()).filter(Boolean);
            if (manualSerialList.length < quantity) {
                logs.push(await createAndSendLog({
                    entity_number: resolvedModelNumber,
                    activity: 'CHECK_QTY',
                    status: 'FAILED',
                    message: `Provided serial count (${manualSerialList.length}) is less than required quantity (${quantity}).`,
                    logged_by: req.user?.id,
                    log_type: 'PICK_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            candidates = await db.put.findAll({
                where: {
                    serial_number: { [Op.in]: manualSerialList },
                    pick_id: null
                },
                include: [{ model: db.handling_unit }]
            }) || [];

            if (candidates.length < manualSerialList.length) {
                const foundSerials = new Set(candidates.map(c => c.serial_number));
                const missing = manualSerialList.filter(s => !foundSerials.has(s));
                logs.push(await createAndSendLog({
                    entity_number: resolvedModelNumber,
                    activity: 'FETCH_DETAILS',
                    status: 'FAILED',
                    message: `Some scanned serials are not available in inventory or already picked: ${missing.join(', ')}`,
                    logged_by: req.user?.id,
                    log_type: 'PICK_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }
        } else {
            // Mode A: FIFO Auto-Selection
            // Pull available inventory ordered by birth_date ASC
            candidates = await db.put.findAll({
                where: {
                    model_number: resolvedModelNumber,
                    pick_id: null
                },
                include: [{ model: db.handling_unit }],
                order: [['birth_date', 'ASC']]
            }) || [];

            // If a specific serial was scanned to initiate, place it first in line
            if (seedSerial) {
                const seedIdx = candidates.findIndex(c => c.serial_number === seedSerial);
                if (seedIdx > 0) {
                    const [seedItem] = candidates.splice(seedIdx, 1);
                    candidates.unshift(seedItem);
                }
            }

            if (candidates.length < quantity) {
                logs.push(await createAndSendLog({
                    entity_number: resolvedModelNumber,
                    activity: 'FETCH_DETAILS',
                    status: 'FAILED',
                    message: `Insufficient inventory for model ${resolvedModelNumber}. Available: ${candidates.length}, Requested: ${quantity}.`,
                    logged_by: req.user?.id,
                    log_type: 'PICK_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }
        }

        // Loop and validate candidates against MES until target quantity is reached
        let validSerialNumbers = [];

        for (let i = 0; i < candidates.length; i++) {
            const putEntry = candidates[i];
            safeWriteSSE(res, {
                entity_number: resolvedModelNumber,
                activity: 'FETCH_DETAILS',
                status: 'IN_PROGRESS',
                message: `Verifying MES status for serial ${putEntry.serial_number} (${validSerialNumbers.length}/${quantity} confirmed)...`,
                completed: false,
                process_id
            });

            // 1. Concurrent MES PV Status & WIP Hold Checks
            const [pvStatusResponse, getWipSerialResponse] = await Promise.all([
                getPVStatusCheck(putEntry.serial_number, pickProcessStep),
                getWipBySerialNumber(putEntry.serial_number)
            ]);

            if (pvStatusResponse?.isError) {
                if (serialsQuery) {
                    logs.push(await createAndSendLog({
                        entity_number: putEntry.serial_number,
                        activity: 'FETCH_DETAILS',
                        status: 'FAILED',
                        message: `PV Status API check failed for serial ${putEntry.serial_number}: ${pvStatusResponse?.error?.message || 'Error'}`,
                        logged_by: req.user?.id,
                        log_type: 'PICK_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
                // In auto mode, skip to next candidate
                continue;
            }

            await putEntry.update({ pv_status: pvStatusResponse === 'PASS' ? 'PASS' : 'FAIL' });
            if (pvStatusResponse !== 'PASS') {
                if (serialsQuery) {
                    logs.push(await createAndSendLog({
                        entity_number: putEntry.serial_number,
                        activity: 'CHECK_STATUS',
                        status: 'FAILED',
                        message: `Serial ${putEntry.serial_number} failed PV Status check (Result: ${pvStatusResponse}).`,
                        logged_by: req.user?.id,
                        log_type: 'PICK_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
                continue;
            }

            // 2. Process WIP Hold Check Result
            if (getWipSerialResponse?.isError) {
                if (serialsQuery) {
                    logs.push(await createAndSendLog({
                        entity_number: putEntry.serial_number,
                        activity: 'FETCH_DETAILS',
                        status: 'FAILED',
                        message: `Get WIP API failed for serial ${putEntry.serial_number}.`,
                        logged_by: req.user?.id,
                        log_type: 'PICK_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
                continue;
            }

            const isOnHold = getWipSerialResponse.data?.CurrentlyOnHold;
            if (isOnHold) {
                await putEntry.update({ pick_status: 'HOLD' });
                if (serialsQuery) {
                    logs.push(await createAndSendLog({
                        entity_number: putEntry.serial_number,
                        activity: 'CHECK_STATUS',
                        status: 'FAILED',
                        message: `Serial ${putEntry.serial_number} is currently ON HOLD in MES WIP.`,
                        logged_by: req.user?.id,
                        log_type: 'PICK_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
                continue;
            }

            validSerialNumbers.push(putEntry);
            if (validSerialNumbers.length === quantity) {
                break;
            }
        }

        if (validSerialNumbers.length < quantity) {
            logs.push(await createAndSendLog({
                entity_number: resolvedModelNumber,
                activity: 'CHECK_QTY',
                status: 'FAILED',
                message: `Insufficient valid parts meeting MES criteria (${validSerialNumbers.length}/${quantity} passed).`,
                logged_by: req.user?.id,
                log_type: 'PICK_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        logs.push(await createAndSendLog({
            entity_number: resolvedModelNumber,
            activity: 'FETCH_DETAILS',
            status: 'SUCCESS',
            message: `Successfully verified ${validSerialNumbers.length} serial numbers for model ${resolvedModelNumber}.`,
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        logs.push(await createAndSendLog({
            entity_number: resolvedModelNumber,
            activity: 'CHECK_QTY',
            status: 'SUCCESS',
            message: `Required quantity (${quantity}/${quantity}) verified and confirmed.`,
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        // Update Board History for all verified units
        let updatedEntries = [];
        for (let i = 0; i < validSerialNumbers.length; i++) {
            const putEntry = validSerialNumbers[i];
            safeWriteSSE(res, {
                entity_number: resolvedModelNumber,
                activity: 'CHECK_STATUS',
                status: 'IN_PROGRESS',
                message: `Updating board history in MES for serial ${putEntry.serial_number} (${i + 1}/${validSerialNumbers.length})...`,
                completed: false,
                process_id
            });

            const updateResponse = await updateBoardHistory({
                serialNumber: putEntry.serial_number,
                processName: pickProcessStep,
                userId: req.user?.user_id || 'SYSTEM',
                startTime: startTime,
                endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                result: 'P'
            });

            if (!updateResponse?.isError) {
                updatedEntries.push(putEntry);
            } else {
                console.warn(`Board history update note for serial ${putEntry.serial_number}:`, updateResponse?.error || updateResponse);
                updatedEntries.push(putEntry);
            }
        }

        logs.push(await createAndSendLog({
            entity_number: resolvedModelNumber,
            activity: 'CHECK_STATUS',
            status: 'SUCCESS',
            message: `MES Kanban board history updated for all ${updatedEntries.length} serial numbers.`,
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        // Signal FILE_GENERATED in-progress to frontend immediately
        safeWriteSSE(res, {
            entity_number: resolvedModelNumber,
            activity: 'FILE_GENERATED',
            status: 'IN_PROGRESS',
            message: `Generating pick order text file for ${updatedEntries.length} line items...`,
            completed: false,
            process_id
        });

        // Calculate 2-digit sequential order run for this model (e.g. SA005157-PICK-01)
        const existingPickCount = await db.files.count({
            where: {
                name: { [Op.like]: `PICK_${resolvedModelNumber}_%` }
            }
        });
        const pickSeq = String(existingPickCount + 1).padStart(2, '0');
        const genFileName = `PICK_${resolvedModelNumber}_${pickSeq}_${Date.now()}.txt`;
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

        // Build Kardex Pick Order content: <MODEL>-PICK-<01>|serial|model|1|binName
        const pickOrderNumber = `${resolvedModelNumber}-PICK-${pickSeq}`;
        const content = updatedEntries.map((pt) => {
            const binName = pt?.handling_unit?.hu_id || '';
            return `${pickOrderNumber}|${pt?.serial_number}|${pt?.model_number || resolvedModelNumber}|1|${binName}`;
        }).join('\r\n');

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
            model_number: resolvedModelNumber,
            quantity: quantity,
            process_status: pickProcessStep,
            entered_by: req.user?.id,
            text_file_id: newFile.id
        });
        await savedPickEntry.setPuts(updatedEntries);

        // Bulk update all picked put entries
        if (updatedEntries.length > 0) {
            const entryIds = updatedEntries.map(e => e.id);
            await db.put.update(
                {
                    pick_status: 'PICKED',
                    process_status: pickProcessStep,
                    compartment_id: null,
                    pick_id: savedPickEntry.id
                },
                { where: { id: entryIds } }
            );

            // If any picked items were stored in Handling Unit compartments, clear them
            try {
                const affectedHUIds = new Set();
                for (const pt of updatedEntries) {
                    if (pt.compartment_id) {
                        await db.compartment.update(
                            { status: 'EMPTY', serial_number: null, material_name: null, allocated_at: null, allocated_by: null },
                            { where: { id: pt.compartment_id } }
                        );
                    }
                    if (pt.handling_unit_id) {
                        affectedHUIds.add(pt.handling_unit_id);
                    }
                }
                for (const huId of affectedHUIds) {
                    const compartments = await db.compartment.findAll({ where: { handling_unit_id: huId } });
                    if (compartments && compartments.length > 0) {
                        const allEmpty = compartments.every(c => c.status === 'EMPTY');
                        const allOccupied = compartments.every(c => c.status === 'OCCUPIED');
                        const nextStatus = allEmpty ? 'EMPTY' : (allOccupied ? 'FULL' : 'PARTIALLY_FILLED');
                        await db.handling_unit.update({ hu_status: nextStatus }, { where: { id: huId } });
                    }
                }
            } catch (huErr) {
                console.error('Error clearing HU compartments on pick:', huErr);
            }
        }

        logs.push(await createAndSendLog({
            entity_number: resolvedModelNumber,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: `File ${genFileName} generated successfully with ${updatedEntries.length} line items.`,
            success: true,
            fileName: genFileName,
            file_id: newFile.id,
            pick_id: savedPickEntry.id,
            lineCount: updatedEntries.length,
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));

        await savedPickEntry.setLogs(logs);
        return res.end();
    }
    catch (err) {
        const activeStep = progressTimeline[activeProgressStep] || 'FETCH_DETAILS';
        await createAndSendLog({
            entity_number: rawInput,
            activity: activeStep,
            status: 'FAILED',
            message: err?.message || String(err),
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res);
        return res.end();
    }
});

async function createAndSendLog(log, res) {
    let saved = null;
    try {
        saved = await db.log.create(log);
    } catch (dbErr) {
        if (log?.message && typeof log.message === 'string') {
            try {
                saved = await db.log.create({
                    ...log,
                    message: log.message.slice(0, 250)
                });
            } catch (e) {
                console.error('Failed to persist log in DB:', e.message);
            }
        }
    }
    const payload = {
        ...log,
        ...(saved ? saved.get() : {}),
        message: log.message,
        completed: true
    };
    safeWriteSSE(res, payload);
    return saved || { id: null, ...log };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /pick/plan
// Calculates FIFO inventory allocation across Handling Units (Bins)
// Returns bin breakdown with quantities without executing Kanban-Out or altering DB
// ─────────────────────────────────────────────────────────────────────────────
exports.getPickPlan = asyncHandler(async (req, res) => {
    try {
        const { modelNumber: rawModelParam, quantity = 1 } = req.body;
        const cleanInput = String(rawModelParam || '').trim();
        const reqQty = Math.max(1, parseInt(quantity, 10) || 1);

        if (!cleanInput) {
            return res.status(400).json({ error: 'Model number or serial number is required.' });
        }

        // 1. Resolve model number if a serial number was scanned instead
        let resolvedModelNumber = cleanInput;
        let seedSerial = null;
        const matchedSerial = await db.put.findOne({
            where: { serial_number: cleanInput }
        });
        if (matchedSerial && matchedSerial.model_number) {
            resolvedModelNumber = matchedSerial.model_number;
            seedSerial = cleanInput;
        }

        // 2. Count total available in Kardex for this model
        const totalAvailable = await db.put.count({
            where: {
                model_number: resolvedModelNumber,
                pick_id: null
            }
        });

        if (totalAvailable === 0) {
            return res.status(200).json({
                resolvedModelNumber,
                requestedQuantity: reqQty,
                totalAvailable: 0,
                allocatedQuantity: 0,
                bins: [],
                message: `No available inventory found for model "${resolvedModelNumber}".`
            });
        }

        // 3. Find candidates according to FIFO (ordered by birth_date ASC)
        // If seedSerial was scanned, prioritize it first
        const isPg = db.sequelize.getDialect() === 'postgres';
        const putSerialCol = isPg ? '"put"."serial_number"' : 'put.serial_number';
        const orderClause = seedSerial
            ? [
                [db.sequelize.literal(`CASE WHEN ${putSerialCol} = ${db.sequelize.escape(seedSerial)} THEN 0 ELSE 1 END`), 'ASC'],
                ['birth_date', 'ASC']
            ]
            : [['birth_date', 'ASC']];

        const candidates = await db.put.findAll({
            where: {
                model_number: resolvedModelNumber,
                pick_id: null
            },
            include: [
                { model: db.compartment, required: false },
                { model: db.handling_unit, required: false }
            ],
            order: orderClause,
            limit: reqQty
        });

        // 4. Group candidates by Handling Unit (Bin)
        const binMap = new Map();

        for (const item of candidates) {
            const huId = item.handling_unit?.hu_id || 'NO_BIN';
            const huPk = item.handling_unit_id || null;

            if (!binMap.has(huId)) {
                binMap.set(huId, {
                    hu_id: huId,
                    handling_unit_id: huPk,
                    storage_status: item.handling_unit?.storage_status || 'UNKNOWN',
                    qty: 0,
                    serials: [],
                    compartments: [],
                    items: []
                });
            }

            const binEntry = binMap.get(huId);
            binEntry.qty += 1;
            binEntry.serials.push(item.serial_number);
            if (item.compartment?.compartment_number) {
                binEntry.compartments.push(item.compartment.compartment_number);
            }
            binEntry.items.push({
                id: item.id,
                serial_number: item.serial_number,
                model_number: item.model_number,
                compartment_number: item.compartment?.compartment_number || null,
                compartment_id: item.compartment_id,
                birth_date: item.birth_date
            });
        }

        const bins = Array.from(binMap.values());

        return res.status(200).json({
            resolvedModelNumber,
            requestedQuantity: reqQty,
            totalAvailable,
            allocatedQuantity: candidates.length,
            bins,
            totalBins: bins.length
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /pick/create-bin/:huId/:modelNumber/:qty?serials=...
// Isolated Bin-Wise Pick Execution with SSE live stream:
// Only performs MES Kanban-Out and compartment clearing for units in the scanned bin.
// ─────────────────────────────────────────────────────────────────────────────
exports.createBinPick = asyncHandler(async (req, res) => {
    const startTime = moment().format('MM/DD/YYYY hh:mm:ss A');
    const process_id = uuid4();
    const { huId: rawHuId, modelNumber: rawModelParam, qty: rawQty } = req.params;
    const targetHuId = decodeURIComponent(rawHuId || '').trim();
    const resolvedModelNumber = decodeURIComponent(rawModelParam || '').trim();
    const quantity = Number(rawQty) || 1;
    const pickProcessStep = process.env.KanbanOutProcessStep || 'KANBAN-OUT';
    const serialsQuery = req.query?.serials;
    const logs = [];

    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // 1. Initial SSE event
        safeWriteSSE(res, {
            entity_number: `${targetHuId} (${resolvedModelNumber})`,
            activity: 'FETCH_DETAILS',
            status: 'IN_PROGRESS',
            message: `Starting pick validation for Bin ${targetHuId} (${resolvedModelNumber}, ${quantity} units)...`,
            completed: false,
            process_id
        });

        // 2. Resolve candidates for this specific bin
        let candidates = [];
        let huRecord = null;
        if (targetHuId !== 'NO_BIN') {
            huRecord = await db.handling_unit.findOne({ where: { hu_id: targetHuId } });
        }

        const whereCondition = {
            model_number: resolvedModelNumber,
            pick_id: null
        };
        if (huRecord) {
            whereCondition.handling_unit_id = huRecord.id;
        }

        if (serialsQuery) {
            const manualSerialList = serialsQuery.split(',').map(s => decodeURIComponent(s).trim()).filter(Boolean);
            if (manualSerialList.length > 0) {
                whereCondition.serial_number = { [Op.in]: manualSerialList };
            }
        }

        candidates = await db.put.findAll({
            where: whereCondition,
            order: [['birth_date', 'ASC']],
            limit: quantity
        });

        if (!candidates || candidates.length === 0) {
            logs.push(await createAndSendLog({
                entity_number: targetHuId,
                activity: 'FETCH_DETAILS',
                status: 'FAILED',
                message: `No available inventory found in Bin ${targetHuId} for model ${resolvedModelNumber}.`,
                logged_by: req.user?.id,
                log_type: 'PICK_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        // 3. MES Validation per serial in this bin
        let validSerialNumbers = [];
        for (let i = 0; i < candidates.length; i++) {
            const putEntry = candidates[i];
            safeWriteSSE(res, {
                entity_number: putEntry.serial_number,
                activity: 'FETCH_DETAILS',
                status: 'IN_PROGRESS',
                message: `[Bin ${targetHuId}] Verifying MES status for serial ${putEntry.serial_number} (${validSerialNumbers.length}/${candidates.length})...`,
                completed: false,
                process_id
            });

            const [pvStatusResponse, getWipSerialResponse] = await Promise.all([
                getPVStatusCheck(putEntry.serial_number, pickProcessStep),
                getWipBySerialNumber(putEntry.serial_number)
            ]);

            if (pvStatusResponse?.isError || pvStatusResponse !== 'PASS') {
                logs.push(await createAndSendLog({
                    entity_number: putEntry.serial_number,
                    activity: 'CHECK_STATUS',
                    status: 'FAILED',
                    message: `[Bin ${targetHuId}] Serial ${putEntry.serial_number} failed PV Status check (${pvStatusResponse?.error?.message || pvStatusResponse}).`,
                    logged_by: req.user?.id,
                    log_type: 'PICK_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            const isOnHold = getWipSerialResponse?.data?.CurrentlyOnHold;
            if (isOnHold) {
                await putEntry.update({ pick_status: 'HOLD' });
                logs.push(await createAndSendLog({
                    entity_number: putEntry.serial_number,
                    activity: 'CHECK_STATUS',
                    status: 'FAILED',
                    message: `[Bin ${targetHuId}] Serial ${putEntry.serial_number} is currently ON HOLD in MES WIP.`,
                    logged_by: req.user?.id,
                    log_type: 'PICK_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            validSerialNumbers.push(putEntry);
        }

        // 4. Update Board History (Kanban-Out) for verified units in this bin
        let updatedEntries = [];
        for (let i = 0; i < validSerialNumbers.length; i++) {
            const putEntry = validSerialNumbers[i];
            safeWriteSSE(res, {
                entity_number: putEntry.serial_number,
                activity: 'CHECK_STATUS',
                status: 'IN_PROGRESS',
                message: `[Bin ${targetHuId}] Updating Kanban-Out in MES for serial ${putEntry.serial_number} (${i + 1}/${validSerialNumbers.length})...`,
                completed: false,
                process_id
            });

            await updateBoardHistory({
                serialNumber: putEntry.serial_number,
                processName: pickProcessStep,
                userId: req.user?.user_id || 'SYSTEM',
                startTime: startTime,
                endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                result: 'P'
            });

            updatedEntries.push(putEntry);
        }

        logs.push(await createAndSendLog({
            entity_number: targetHuId,
            activity: 'CHECK_STATUS',
            status: 'SUCCESS',
            message: `[Bin ${targetHuId}] MES Kanban-Out completed for ${updatedEntries.length} serial numbers.`,
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));

        // 5. Generate Kardex Pick text file for this bin
        const existingPickCount = await db.files.count({
            where: {
                name: { [Op.like]: `PICK_${resolvedModelNumber}_%` }
            }
        });
        const pickSeq = String(existingPickCount + 1).padStart(2, '0');
        const cleanHuForFile = targetHuId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const genFileName = `PICK_${resolvedModelNumber}_${cleanHuForFile}_${pickSeq}_${Date.now()}.txt`;
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

        const pickOrderNumber = `${resolvedModelNumber}-PICK-${pickSeq}`;
        const content = updatedEntries.map((pt) => {
            const binName = targetHuId || pt?.handling_unit?.hu_id || '';
            return `${pickOrderNumber}|${pt?.serial_number}|${pt?.model_number || resolvedModelNumber}|1|${binName}`;
        }).join('\r\n');

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
            model_number: resolvedModelNumber,
            quantity: updatedEntries.length,
            process_status: pickProcessStep,
            entered_by: req.user?.id,
            text_file_id: newFile.id
        });
        await savedPickEntry.setPuts(updatedEntries);

        // 6. Update puts and clear compartments for this bin
        const entryIds = updatedEntries.map(e => e.id);
        await db.put.update(
            {
                pick_status: 'PICKED',
                process_status: pickProcessStep,
                compartment_id: null,
                pick_id: savedPickEntry.id
            },
            { where: { id: entryIds } }
        );

        if (huRecord) {
            for (const pt of updatedEntries) {
                if (pt.compartment_id) {
                    await db.compartment.update(
                        { status: 'EMPTY', serial_number: null, material_name: null, allocated_at: null, allocated_by: null },
                        { where: { id: pt.compartment_id } }
                    );
                }
            }
            // Clear any compartments matching picked serials in this HU as well
            const pickedSerials = updatedEntries.map(e => e.serial_number);
            await db.compartment.update(
                { status: 'EMPTY', serial_number: null, material_name: null, allocated_at: null, allocated_by: null },
                {
                    where: {
                        handling_unit_id: huRecord.id,
                        serial_number: { [Op.in]: pickedSerials }
                    }
                }
            );

            // Recalculate HU status
            const compartments = await db.compartment.findAll({ where: { handling_unit_id: huRecord.id } });
            if (compartments && compartments.length > 0) {
                const allEmpty = compartments.every(c => c.status === 'EMPTY');
                const allOccupied = compartments.every(c => c.status === 'OCCUPIED');
                const nextStatus = allEmpty ? 'EMPTY' : (allOccupied ? 'FULL' : 'PARTIALLY_FILLED');
                await db.handling_unit.update({ hu_status: nextStatus }, { where: { id: huRecord.id } });
            }
        }

        // 7. Send final success event
        logs.push(await createAndSendLog({
            entity_number: targetHuId,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: `[Bin ${targetHuId}] File ${genFileName} generated for ${updatedEntries.length} picked items.`,
            success: true,
            fileName: genFileName,
            file_id: newFile.id,
            pick_id: savedPickEntry.id,
            lineCount: updatedEntries.length,
            hu_id: targetHuId,
            picked_serials: updatedEntries.map(e => e.serial_number),
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));

        return res.end();

    } catch (err) {
        await createAndSendLog({
            entity_number: targetHuId,
            activity: 'FILE_GENERATED',
            status: 'FAILED',
            message: err?.message || String(err),
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res);
        return res.end();
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
                        whereConditions[column][Op.like] = `% ${filters[key]}% `;
                        break;
                    case 'equals':
                        whereConditions[column][Op.eq] = filters[key];
                        break;
                    default:
                        throw new Error(`Unsupported filter operation: ${operation} `);
                }
            }
        });

        // Calculate pagination values
        const offset = (page - 1) * size;
        const limit = parseInt(size, 10);

        // Perform the query
        const { rows, count } = await db.pick.findAndCountAll({
            where: whereConditions,
            order: safeOrder(sort, ['id', 'model_number', 'quantity', 'scanned_at', 'updated_at'], 'id', 'DESC'),
            limit,
            offset,
            include: [
                {
                    model: db.files,
                    as: 'pick_text_file',
                },
                {
                    model: db.put,
                },
            ],
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


exports.updatePick = asyncHandler(async (req, res) => {
    try {
        const pick = await db.pick.findByPk(req.params.id);
        if (!pick) return res.status(404).json({ error: 'Pick not found' });
        await pick.update(req.body);
        res.status(200).json(pick);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


exports.deletePick = asyncHandler(async (req, res) => {
    try {
        const pick = await db.pick.findByPk(req.params.id);
        if (!pick) return res.status(404).json({ error: 'Pick not found' });
        await pick.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

exports.getPick = asyncHandler(async (req, res) => {
    try {
        const pick = await db.pick.findByPk(req.params.id);
        if (!pick) return res.status(404).json({ error: 'Pick not found' });
        res.status(200).json(pick);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

exports.getUndownloadedPicks = asyncHandler(async (req, res) => {
    const { quantity } = req.body;


    if (!quantity || isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Invalid quantity.' });
    }

    try {

        const puts = await db.put.findAll({
            where: {
                pick_id: { [Op.ne]: null },
                pick_file_downloaded: false,
                //'$pick.text_file_downloaded$': false,
                '$pick.text_file_id$': { [Op.ne]: null },
            },
            include: [
                {
                    model: db.pick
                },
                {
                    model: db.handling_unit
                }
            ],
            order: [['scanned_at', 'DESC']],
            limit: Number(quantity),
        })

        if (quantity > puts?.length) {
            return res.status(400).json({
                message: `Only ${puts?.length}/${quantity} files are availbale to download.`
            });
        }

        if (!puts || puts.length === 0) {
            return res.status(404).json({ message: 'No files found to download.' });
        }

        const content = puts.map((pt) => {
            const m = pt?.model_number || 'MODEL';
            const s = String(pt.pick_id || puts[0]?.pick_id || 1).padStart(2, '0');
            const binName = pt?.handling_unit?.hu_id || '';
            return `${m}-PICK-${s}|${pt?.serial_number}|${m}|1|${binName}`;
        }).join('\r\n');

        res.setHeader('Content-Disposition', 'attachment; filename="orders.txt"');
        res.setHeader('Content-Type', 'text/plain');

        for (const pt of puts) {
            await pt.update({ pick_file_downloaded: true });
        }

        const pickIds = new Set(puts.map((pt) => (pt?.pick_id)));
        for (const pickId of pickIds) {
            await db.pick.update({ text_file_downloaded: true }, { where: { id: pickId } })
        }


        // Send the text content as a response
        return res.send(content);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }

});

exports.downloadFile = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Invalid quantity.' });
    }
    const pick = await db.pick.findByPk(id, { include: [{ model: db.files, foreignKey: 'text_file_id', as: 'pick_text_file' }, { model: db.put }] });

    if (!pick) {
        return res.status(404).json({ message: 'Pick not found' });
    }

    if (!pick.pick_text_file) {
        return res.status(404).json({ message: 'No file found for this pick.' });
    }

    const fileName = pick.pick_text_file?.name;

    const candidatePaths = [
        pick.pick_text_file?.path ? path.resolve(pick.pick_text_file.path) : null,
        path.resolve(`uploads/files/pick/${fileName}`),
        path.resolve(`uploads/files/put/${fileName}`),
        path.resolve('uploads', 'files', 'pick', fileName),
        path.resolve('uploads', 'files', 'put', fileName),
        process.env.Pick_Text_File_Path ? path.resolve(process.env.Pick_Text_File_Path, fileName) : null,
        process.env.Put_Text_File_Path ? path.resolve(process.env.Put_Text_File_Path, fileName) : null,
    ].filter(Boolean);

    const filePath = candidatePaths.find(p => fs.existsSync(p));

    if (!filePath) {
        return res.status(404).send({ error: 'File cannot be downloaded' });
    }

    await pick.update({ text_file_downloaded: true });
    if (pick?.puts) {
        for (const put of pick.puts) {
            await put.update({ pick_file_downloaded: true });
        }
    }

    res.setHeader('File-Name', encodeURIComponent(fileName));
    // Send the file for download
    res.download(filePath, fileName, (err) => {
        if (err) {
            res.status(500).send({ error: 'Error downloading file' });
        }
    });
});

exports.validateSerialForPick = asyncHandler(async (req, res) => {
    const { serialNumber, modelNumber } = req.body;
    if (!serialNumber) {
        return res.status(400).json({ error: 'Serial number is required.' });
    }
    const cleanSerial = String(serialNumber).trim();
    const pickProcessStep = process.env.KanbanOutProcessStep || 'KANBAN-OUT';

    // 1. Check if serial exists in stock and is available
    const putRecord = await db.put.findOne({
        where: {
            serial_number: cleanSerial,
            pick_id: null
        },
        include: [
            { model: db.compartment },
            { model: db.handling_unit }
        ]
    });

    if (!putRecord) {
        const alreadyPicked = await db.put.findOne({ where: { serial_number: cleanSerial } });
        if (alreadyPicked) {
            return res.status(400).json({
                error: `Serial ${cleanSerial} was already picked${alreadyPicked.scanned_at ? ` on ${moment(alreadyPicked.scanned_at).format('MM/DD/YYYY')}` : ''}.`
            });
        }
        return res.status(404).json({ error: `Serial ${cleanSerial} not found in available Kardex inventory.` });
    }

    // 2. Check model match if modelNumber was specified
    if (modelNumber && putRecord.model_number && putRecord.model_number.toUpperCase() !== String(modelNumber).trim().toUpperCase()) {
        return res.status(400).json({
            error: `Serial ${cleanSerial} belongs to model "${putRecord.model_number}", but required model is "${modelNumber}".`
        });
    }

    // 3. PV Status Check (KANBAN-OUT)
    const pvStatusResponse = await getPVStatusCheck(cleanSerial, pickProcessStep);
    if (pvStatusResponse?.isError) {
        return res.status(400).json({
            error: `PV Status API check failed: ${pvStatusResponse?.error?.message || 'Unknown MES error'}`
        });
    }
    await putRecord.update({ pv_status: pvStatusResponse === 'PASS' ? 'PASS' : 'FAIL' });
    if (pvStatusResponse !== 'PASS') {
        return res.status(400).json({
            error: `Serial ${cleanSerial} failed PV Status check (Result: ${pvStatusResponse}). Cannot be picked.`
        });
    }

    // 4. WIP Hold Check
    const wipResponse = await getWipBySerialNumber(cleanSerial);
    if (wipResponse?.isError) {
        return res.status(400).json({
            error: `WIP Status check failed: ${wipResponse?.error?.message || 'Unknown MES error'}`
        });
    }
    const isOnHold = wipResponse?.data?.CurrentlyOnHold;
    if (isOnHold) {
        await putRecord.update({ pick_status: 'HOLD' });
        return res.status(400).json({
            error: `Serial ${cleanSerial} is currently marked ON HOLD in MES WIP.`
        });
    }

    return res.status(200).json({
        success: true,
        message: `Serial ${cleanSerial} verified successfully.`,
        data: {
            id: putRecord.id,
            serial_number: putRecord.serial_number,
            model_number: putRecord.model_number,
            pv_status: 'PASS',
            compartment_number: putRecord.compartment?.compartment_number || null,
            handling_unit_id: putRecord.handling_unit_id,
            bin_hu_id: putRecord.handling_unit?.hu_id || null,
            birth_date: putRecord.birth_date
        }
    });
});

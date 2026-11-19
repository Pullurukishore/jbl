const asyncHandler = require('express-async-handler');
const fs = require("fs");
const path = require("path");
const db = require('../models');
const { Op } = require('sequelize');
const uuid4 = require('uuid4');
const ExcelJS = require("exceljs");
const { parseTextFile, mountNetworkDrive, getLatestTxtFromNetworkDrive } = require('../utils/file.utils');
const moment = require('moment');
const { getPVStatusCheck, updateBoardHistory, getBoardHistory, getWipBySerialNumber } = require('../utils/api-call');


// In-memory cache for parsed PO files to eliminate redundant parsing
let cachedPoFileName = null;
let cachedPoMtime = null;
let cachedPoResults = null;

exports.createPut = asyncHandler(async (req, res) => {
    const startTime = moment().format('MM/DD/YYYY hh:mm:ss A');
    const progressTimeline = ['FETCH_DETAILS', 'CHECK_STATUS', 'PASS_FAIL', 'FIND_CSV', 'FIND_MODEL', 'MODEL_FOUND/NOTFOUND', 'CHECKING_AVAILABILITY'];
    let activeProgressStep = 0;
    const serialNumber = req.params?.serialNumber?.trim();
    const process_id = uuid4();

    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Immediate initial progress event to establish live SSE connection without lag
        res.write("data: " + JSON.stringify({
            entity_number: serialNumber,
            activity: 'FETCH_DETAILS',
            status: 'IN_PROGRESS',
            message: 'Fetching board details & checking status...',
            completed: false,
            process_id
        }) + "\n\n");
        if (typeof res.flush === 'function') res.flush();

        const logs = [];

        // Validate Handling Unit capacity upfront if hu_id is provided
        let targetHU = null;
        let targetComp = null;
        if (req.query?.hu_id) {
            targetHU = await db.handling_unit.findOne({
                where: { hu_id: req.query.hu_id },
                include: [{ model: db.compartment }]
            });
            if (!targetHU) {
                logs.push(await createAndSendLog({
                    entity_number: serialNumber,
                    activity: 'FETCH_DETAILS',
                    status: 'FAILED',
                    message: `Handling Unit ${req.query.hu_id} not found.`,
                    logged_by: req.user?.id,
                    log_type: 'PUT_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            const huComps = targetHU.compartments || [];
            const emptyComps = huComps.filter(c => c.status === 'EMPTY');
            if (huComps.length > 0 && emptyComps.length === 0) {
                logs.push(await createAndSendLog({
                    entity_number: serialNumber,
                    activity: 'FETCH_DETAILS',
                    status: 'FAILED',
                    message: `Handling Unit ${req.query.hu_id} is completely full (all ${huComps.length} compartments occupied). Further scanning is not allowed.`,
                    logged_by: req.user?.id,
                    log_type: 'PUT_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            if (req.query?.compartment_number) {
                const compNum = parseInt(req.query.compartment_number, 10);
                targetComp = huComps.find(c => c.compartment_number === compNum);
                if (!targetComp) {
                    logs.push(await createAndSendLog({
                        entity_number: serialNumber,
                        activity: 'FETCH_DETAILS',
                        status: 'FAILED',
                        message: `Compartment #${compNum} not found in Handling Unit ${req.query.hu_id}.`,
                        logged_by: req.user?.id,
                        log_type: 'PUT_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
                if (targetComp.status === 'OCCUPIED') {
                    logs.push(await createAndSendLog({
                        entity_number: serialNumber,
                        activity: 'FETCH_DETAILS',
                        status: 'FAILED',
                        message: `Compartment #${compNum} in Handling Unit ${req.query.hu_id} is already occupied.`,
                        logged_by: req.user?.id,
                        log_type: 'PUT_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
            } else {
                targetComp = emptyComps.sort((a, b) => a.compartment_number - b.compartment_number)[0];
            }
        }

        const boardHistoryResponse = await getBoardHistory(serialNumber);
        if (boardHistoryResponse?.isError) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FETCH_DETAILS',
                status: 'FAILED',
                message: `Board History Api Failed. ${boardHistoryResponse?.error?.message ? `(${boardHistoryResponse?.error?.message})` : ''}`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        const historyData = Array.isArray(boardHistoryResponse?.data) ? boardHistoryResponse.data : [];
        if (historyData.length === 0) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FETCH_DETAILS',
                status: 'FAILED',
                message: `No board history records found in MES for serial ${serialNumber}.`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        const isKanbanIn = historyData.some((part) => (
            ['KANBAN-IN', 'KANBAN_IN'].some(step => part.Test_Process?.toUpperCase()?.trim()?.includes(step))
        ));
        const isKanbanOut = historyData.some((part) => (
            ['KANBAN-OUT', 'KANBAN_OUT'].some(step => part.Test_Process?.toUpperCase()?.trim()?.includes(step))
        ));

        if (isKanbanIn && !isKanbanOut) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FETCH_DETAILS',
                status: 'FAILED',
                message: 'Only Kanban IN found, hence not allowed.',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        let existingPart = await db.put.findOne({
            where: { serial_number: serialNumber },
            order: [['id', 'DESC']]
        });
        let testProcess = process.env.KanbanInProcessStep || 'KANBAN-IN';

        if (isKanbanIn && isKanbanOut) {
            testProcess = process.env.KanbanRtnProcessStep || 'KANBAN-RTN';

            const cooldownHours = parseFloat(process.env.KANBAN_RETURN_COOLDOWN_HOURS || '24');
            const isOverride = (req.body?.override_cooldown === true || req.query?.override_cooldown === 'true') && req.user?.role === 'ADMIN';

            if (cooldownHours > 0 && !isOverride) {
                // Find latest KANBAN-OUT in MES board history
                const kanbanOutSteps = historyData.filter(part =>
                    ['KANBAN-OUT', 'KANBAN_OUT'].some(step => part.Test_Process?.toUpperCase()?.trim()?.includes(step))
                );

                let lastOutTime = null;
                if (kanbanOutSteps.length > 0) {
                    kanbanOutSteps.sort((a, b) => {
                        const dateB = moment(b.EndDateTime || b.StartDateTime).valueOf() || 0;
                        const dateA = moment(a.EndDateTime || a.StartDateTime).valueOf() || 0;
                        return dateB - dateA;
                    });
                    const rawTime = kanbanOutSteps[0].EndDateTime || kanbanOutSteps[0].StartDateTime;
                    if (rawTime && moment(rawTime).isValid()) {
                        lastOutTime = moment(rawTime);
                    }
                }

                // Fallback to local DB if no timestamp found in MES data
                if (!lastOutTime || !lastOutTime.isValid()) {
                    const lastPickedPut = await db.put.findOne({
                        where: { serial_number: serialNumber, pick_status: 'PICKED' },
                        order: [['updatedAt', 'DESC']]
                    });
                    if (lastPickedPut && lastPickedPut.updatedAt && moment(lastPickedPut.updatedAt).isValid()) {
                        lastOutTime = moment(lastPickedPut.updatedAt);
                    }
                }

                if (lastOutTime && lastOutTime.isValid()) {
                    const now = moment();
                    const diffHours = now.diff(lastOutTime, 'hours', true);

                    if (diffHours < cooldownHours) {
                        const remainingMs = (cooldownHours * 3600 * 1000) - now.diff(lastOutTime);
                        const remHours = Math.floor(remainingMs / (3600 * 1000));
                        const remMins = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
                        const eligibleTime = lastOutTime.clone().add(cooldownHours, 'hours');

                        logs.push(await createAndSendLog({
                            entity_number: serialNumber,
                            activity: 'FETCH_DETAILS',
                            status: 'FAILED',
                            message: `Return not allowed yet: Kanban-Out occurred at ${lastOutTime.format('YYYY-MM-DD hh:mm A')}. Requires ${cooldownHours}h cooldown (${remHours}h ${remMins}m remaining, allowed after ${eligibleTime.format('YYYY-MM-DD hh:mm A')}).`,
                            logged_by: req.user?.id,
                            log_type: 'PUT_PROCESS',
                            user_first_name: req.user?.first_name,
                            user_last_name: req.user?.last_name,
                            user_id: req.user?.user_id,
                            process_id
                        }, res));
                        return res.end();
                    }
                }
            }
        }

        const pvStatusResponse = await getPVStatusCheck(serialNumber, testProcess);
        if (pvStatusResponse?.isError) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FETCH_DETAILS',
                status: 'FAILED',
                message: `PV Status Api Failed. ${pvStatusResponse?.error?.message ? `(${pvStatusResponse?.error?.message})` : ''}`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }
        //Fetch Details Success
        logs.push(await createAndSendLog({
            entity_number: serialNumber,
            activity: 'FETCH_DETAILS',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            log_type: 'PUT_PROCESS',
            process_id
        }, res));
        activeProgressStep++;

        // Reject if serial number is already in storage as AVAILABLE
        if (existingPart && existingPart.pick_status === 'AVAILABLE') {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'CHECK_STATUS',
                status: 'FAILED',
                message: 'Serial number is already available in Kardex storage.',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        //check status success
        logs.push(await createAndSendLog({
            entity_number: serialNumber,
            activity: 'CHECK_STATUS',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        if (existingPart?.id) {
            await existingPart.update({ pv_status: pvStatusResponse === 'PASS' ? 'PASS' : 'FAIL' })
        }
        if (pvStatusResponse !== 'PASS') {
            //pv_status status not passed.
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'PASS_FAIL',
                status: 'FAILED',
                message: pvStatusResponse,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        const getWipSerialRespone = await getWipBySerialNumber(serialNumber);
        if (getWipSerialRespone?.isError) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'PASS_FAIL',
                status: 'FAILED',
                message: `Get WIP By serial Api Failed. ${getWipSerialRespone?.error?.message ? `(${getWipSerialRespone?.error?.message})` : ''}`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }
        const isOnHold = getWipSerialRespone.data?.CurrentlyOnHold;
        if (existingPart) {
            await existingPart.update({ pick_status: isOnHold ? 'HOLD' : existingPart.pick_status });
        }
        if (isOnHold) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'PASS_FAIL',
                status: 'FAILED',
                message: 'Serial Number is On Hold.',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }


        // const boardHistoryResponse = await getBoardHistory(serialNumber);
        // if (boardHistoryResponse?.isError) {
        //     logs.push(await createAndSendLog({
        //         entity_number: serialNumber,
        //         activity: 'PASS_FAIL',
        //         status: 'FAILED',
        //         message: 'Board History Api Failed.',
        //         logged_by: req.user?.id,
        //         log_type: 'PUT_PROCESS',
        //         process_id
        //     }, res));
        //     return res.end();
        // }

        const birthProcess = (Array.isArray(boardHistoryResponse?.data) ? boardHistoryResponse.data : []).find(
            prt => prt?.Test_Process?.toUpperCase()?.trim() === 'BIRTH / BIRTH' || prt?.Test_Process?.toUpperCase()?.trim() === 'MTL_ASSEMBLY & LINKING / MTL_ASSEMBLY & LINKING'
        );
        if (!birthProcess) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'PASS_FAIL',
                status: 'FAILED',
                message: 'Birth Process not found in Board history response.',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        if (existingPart?.id) {
            await existingPart.update({ birth_date: createDateFromString(birthProcess?.StartDateTime) });
        }

        const partBirth = new Date(birthProcess?.StartDateTime);
        let dtToChk1 = new Date();
        dtToChk1.setFullYear(dtToChk1.getFullYear() - 2);
        if (!partBirth || partBirth < dtToChk1) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'PASS_FAIL',
                status: 'FAILED',
                message: 'Birth Time of serial number is 2 years old.',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        //status success
        logs.push(await createAndSendLog({
            entity_number: serialNumber,
            activity: 'PASS_FAIL',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        let latestFile = null;
        let results = [];
        const isOffline = process.env.IS_OFFLINE === 'true';

        res.write("data: " + JSON.stringify({
            entity_number: serialNumber,
            activity: 'FIND_CSV',
            status: 'IN_PROGRESS',
            message: 'Searching PO file in network drive...',
            completed: false,
            process_id
        }) + "\n\n");
        if (typeof res.flush === 'function') res.flush();

        if (!isOffline) {
            // Mount the network drive
            const result = await mountNetworkDrive();
            if (result?.isError) {
                logs.push(await createAndSendLog({
                    entity_number: serialNumber,
                    activity: 'FIND_CSV',
                    status: 'FAILED',
                    message: 'Failed to connect shared network drive.',
                    logged_by: req.user?.id,
                    log_type: 'PUT_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            latestFile = await getLatestTxtFromNetworkDrive();
            //const latestFile = await getLatestTxtFromNetworkDriveonDirectory('C:\\Users\\\Administrator\\Desktop\\New folder');

            if (!latestFile) {
                logs.push(await createAndSendLog({
                    entity_number: serialNumber,
                    activity: 'FIND_CSV',
                    status: 'FAILED',
                    message: 'No PO File found in the shared network drive.',
                    logged_by: req.user?.id,
                    log_type: 'PUT_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }

            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FIND_CSV',
                status: 'SUCCESS',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            activeProgressStep++;

            let fileMtime = 0;
            try {
                fileMtime = fs.statSync(latestFile.path).mtimeMs;
            } catch (e) {
                fileMtime = 0;
            }

            if (cachedPoFileName === latestFile.name && cachedPoMtime === fileMtime && cachedPoResults) {
                results = cachedPoResults;
            } else {
                results = await parseTextFile(latestFile.path);
                if (results?.isError) {
                    logs.push(await createAndSendLog({
                        entity_number: serialNumber,
                        activity: 'FIND_MODEL',
                        status: 'FAILED',
                        message: 'Error while parsing PO file. ' + (results.error?.message ? '(' + results.error.message + ')' : ''),
                        logged_by: req.user?.id,
                        log_type: 'PUT_PROCESS',
                        user_first_name: req.user?.first_name,
                        user_last_name: req.user?.last_name,
                        user_id: req.user?.user_id,
                        process_id
                    }, res));
                    return res.end();
                }
                cachedPoFileName = latestFile.name;
                cachedPoMtime = fileMtime;
                cachedPoResults = results;
            }
        } else {
            // Offline Mode: Skip network discovery
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FIND_CSV',
                status: 'SUCCESS',
                message: 'Offline Mode: Skipping PO file discovery.',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            activeProgressStep++;
        }

        const partFrmCsv = results?.some(prt =>
            prt?.['Short text']?.trim()?.toUpperCase() == birthProcess?.Number?.trim()?.toUpperCase() &&
            Number(prt['Open GR'] || prt['OPEN GR'] || 0) > 0
        );

        if (process.env.IS_OFFLINE === 'true') {
            console.log('Offline Mode: Bypassing model availability check.');
        } else if (!partFrmCsv) {
            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'FIND_MODEL',
                status: 'SUCCESS',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            activeProgressStep++;

            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'MODEL_FOUND/NOTFOUND',
                status: 'SUCCESS',
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            activeProgressStep++;


            logs.push(await createAndSendLog({
                entity_number: serialNumber,
                activity: 'CHECKING_AVAILABILITY',
                status: 'FAILED',
                message: `Model number NOT available in PO File. (Part Model: ${birthProcess?.Number || 'N/A'})`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        logs.push(await createAndSendLog({
            entity_number: serialNumber,
            activity: 'FIND_MODEL',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        logs.push(await createAndSendLog({
            entity_number: serialNumber,
            activity: 'MODEL_FOUND/NOTFOUND',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        res.write("data: " + JSON.stringify({
            entity_number: serialNumber,
            activity: 'CHECKING_AVAILABILITY',
            status: 'IN_PROGRESS',
            message: 'Updating Kanban board history & allocating inventory...',
            completed: false,
            process_id
        }) + "\n\n");
        if (typeof res.flush === 'function') res.flush();

        const updateResponse = await updateBoardHistory({
            serialNumber,
            processName: testProcess,
            userId: req.user?.user_id,
            startTime: startTime,
            endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
            result: 'P'
        });
        if (updateResponse?.isError) {
            logs.push(await createAndSendLog({
                entity_number: birthProcess?.SerialNumber,
                activity: 'CHECKING_AVAILABILITY',
                status: 'FAILED',
                message: `Board History Update Failed. ${updateResponse?.error?.message ? `(${updateResponse?.error?.message})` : ''}`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        if (updateResponse !== 'Pass') {
            logs.push(await createAndSendLog({
                entity_number: birthProcess?.SerialNumber,
                activity: 'CHECKING_AVAILABILITY',
                status: 'FAILED',
                message: `Board History Update Failed. ${updateResponse ? `(${updateResponse})` : ''}`,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        /**Latest Source CSV File upload */
        let savedCsvFile = null;
        if (!isOffline && latestFile) {
            try {
                const poUploadPath = path.join('uploads', 'files', 'source-po', latestFile.name);

                // Reuse existing file record if this exact PO was already uploaded
                savedCsvFile = await db.files.findOne({ where: { name: latestFile.name } });

                if (!savedCsvFile) {
                    const poUploadDir = path.dirname(poUploadPath);
                    if (!fs.existsSync(poUploadDir)) {
                        fs.mkdirSync(poUploadDir, { recursive: true });
                    }
                    if (path.resolve(latestFile.path) !== path.resolve(poUploadPath)) {
                        fs.copyFileSync(latestFile.path, poUploadPath);
                    }
                    const poFileStats = fs.statSync(poUploadPath);
                    savedCsvFile = await db.files.create({
                        name: latestFile.name,
                        size: poFileStats.size,
                        type: 'text',
                        path: poUploadPath,
                        created_by: 'SYSTEM',
                        updated_by: 'SYSTEM'
                    });
                }
            } catch (fileErr) {
                console.error('Warning: Failed to copy/save PO file record:', fileErr.message);
            }
        }
        /**Latest Source CSV File upload */

        const isBinScan = !!req.query?.hu_id;
        // Always fall back to the scanned parameter to prevent undefined serial_number in real production
        const finalSerial = serialNumber || birthProcess?.SerialNumber;
        const finalModel = birthProcess?.Number || 'N/A';
        const finalUserId = req?.user?.user_id || (req?.user?.id ? String(req.user.id) : 'SYSTEM');

        let putEntry = existingPart;
        if (putEntry?.id) {
            await putEntry.update({
                serial_number: finalSerial,
                process_status: testProcess,
                pick_status: 'AVAILABLE',
                po_file_id: savedCsvFile?.id,
                text_file_id: putEntry.text_file_id,
                pick_id: null,
                scanned_by: finalUserId,
                text_file_downloaded: false
            });
        }
        else {
            putEntry = await db.put.create({
                serial_number: finalSerial,
                birth_date: createDateFromString(birthProcess?.StartDateTime),
                pv_status: 'PASS',
                process_status: testProcess,
                po_file_id: savedCsvFile?.id,
                model_number: finalModel,
                scanned_by: finalUserId,
                text_file_id: null,
                pick_status: 'AVAILABLE'
            });
        }
        // Link to Handling Unit & Compartment BEFORE sending completion event to eliminate race condition
        if (targetHU && targetComp) {
            try {
                await targetComp.update({
                    status: 'OCCUPIED',
                    serial_number: finalSerial,
                    material_name: finalModel,
                    allocated_at: new Date(),
                    allocated_by: finalUserId
                });
                await putEntry.update({
                    handling_unit_id: targetHU.id,
                    compartment_id: targetComp.id
                });

                const allComps = await db.compartment.findAll({ where: { handling_unit_id: targetHU.id } });
                const allFilled = allComps.length > 0 && allComps.every(c => c.status === 'OCCUPIED');
                const allEmpty = allComps.every(c => c.status === 'EMPTY');
                const nextStatus = allFilled ? 'FULL' : (allEmpty ? 'EMPTY' : 'PARTIALLY_FILLED');
                await targetHU.update({ hu_status: nextStatus });
            } catch (huErr) {
                console.error('Error linking put to Handling Unit:', huErr);
            }
        }

        const successMessage = isBinScan
            ? `Serial Number ${finalSerial} verified and allocated to Bin ${req.query.hu_id}.`
            : `Serial Number ${finalSerial} verified and processed successfully.`;

        logs.push(await createAndSendLog({
            entity_number: finalSerial,
            activity: 'CHECKING_AVAILABILITY',
            status: 'SUCCESS',
            message: successMessage,
            success: true,
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));

        await putEntry.setLogs(logs);
        return res.end();
    }
    catch (err) {
        const activeStep = progressTimeline[activeProgressStep];
        if (activeStep) {
            await createAndSendLog({
                entity_number: serialNumber,
                activity: activeStep,
                status: 'FAILED',
                message: err?.message || err,
                logged_by: req.user?.id,
                log_type: 'PUT_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res);
        }
        res.end();
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
    res.write("data: " + JSON.stringify(payload) + "\n\n");
    if (typeof res.flush === 'function') res.flush();
    return saved || { id: null, ...log };
}

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
        const { rows, count } = await db.put.findAndCountAll({
            where: whereConditions,
            order: [[db.sequelize.literal(sort[0]), sort[1]]],
            limit,
            offset,
            include: [
                {
                    model: db.pick
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


exports.findByModelAndQty = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            size = 5,
            partNumber,
            quantity = 0,
        } = req.body;

        const cleanInput = String(partNumber || '').trim();
        let resolvedModelNumber = cleanInput;
        let isFromSerial = false;
        let seedSerial = null;

        if (cleanInput) {
            // Check if input is a serial number
            const serialCheck = await db.put.findOne({
                where: { serial_number: cleanInput }
            });
            if (serialCheck && serialCheck.model_number) {
                resolvedModelNumber = serialCheck.model_number;
                isFromSerial = true;
                seedSerial = cleanInput;
            }
        }

        const where = {
            model_number: resolvedModelNumber,
            pick_id: null
        };

        const reqQty = Number(quantity) || 0;
        const totalCount = await db.put.count({ where });
        const limit = Math.min(Math.max(Number(size) || 20, 1), 200);
        const offset = (Number(page) - 1) * limit;

        // Fetch paginated rows (putting seed serial first if one was scanned)
        const isPg = db.sequelize.getDialect() === 'postgres';
        const putSerialCol = isPg ? '"put"."serial_number"' : 'put.serial_number';
        const orderClause = seedSerial
            ? [
                [db.sequelize.literal(`CASE WHEN ${putSerialCol} = ${db.sequelize.escape(seedSerial)} THEN 0 ELSE 1 END`), 'ASC'],
                ['birth_date', 'ASC']
            ]
            : [['birth_date', 'ASC']];

        const rows = await db.put.findAll({
            where,
            include: [
                { model: db.compartment, required: false },
                { model: db.handling_unit, required: false }
            ],
            order: orderClause,
            limit,
            offset
        });

        res.status(200).json({
            resolvedModelNumber,
            isFromSerial,
            seedSerial,
            message: totalCount > 0
                ? (reqQty > totalCount ? `Only ${totalCount} available in stock (requested ${reqQty}).` : null)
                : `No available inventory found for model "${resolvedModelNumber}".`,
            data: rows,
            page: Number(page),
            totalPages: Math.ceil(totalCount / limit) || 1,
            totalItems: totalCount,
            availableCount: totalCount
        });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


exports.searchAll = asyncHandler(async (req, res) => {
    try {
        const { search, isExport = false, page = 1, size = 10, sort = ['id', 'DESC'], startDate, endDate } = req.body;

        const dialect = db.sequelize.getDialect();
        const uTable = dialect === 'postgres' ? '"user"' : 'user';
        const pTable = dialect === 'postgres' ? '"put"' : 'put';
        const castText = dialect === 'postgres' ? '::TEXT' : '';

        // Parse page and size into integers
        const pageNumber = parseInt((page - 1), 10);
        const pageSize = parseInt(size, 10);

        const parsedStartDate = startDate
            ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
            : null;

        const parsedEndDate = endDate
            ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
            : null;


        // Validate sort input

        // Clean search string to prevent SQL injection & syntax crashes in raw literals
        const cleanSearch = String(search || '').replace(/'/g, "''");

        // Dynamic search conditions for all columns
        const searchConditions = {
            // Apply date range filter if both dates are provided
            ...(parsedStartDate && parsedEndDate && {
                scanned_at: { [Op.between]: [parsedStartDate, parsedEndDate] },
            }),
            ...(search && {
                [Op.or]: [
                    { serial_number: { [Op.like]: `%${search}%` } },
                    { pv_status: { [Op.like]: `%${search}%` } },
                    { process_status: { [Op.like]: `%${search}%` } },
                    { '$put_po_file.name$': { [Op.like]: `%${search}%` } },
                    { model_number: { [Op.like]: `%${search}%` } },
                    { scanned_by: { [Op.like]: `%${search}%` } },
                    { '$put_text_file.name$': { [Op.like]: `%${search}%` } },
                    { pick_status: { [Op.like]: `%${search}%` } },
                    { '$pick.pick_text_file.name$': { [Op.like]: `%${search}%` } },
                    {
                        [Op.or]: [
                            db.sequelize.literal(
                                `(SELECT COUNT(*) FROM ${uTable} u
                              WHERE u.id${castText} = ${pTable}.scanned_by 
                              AND (u.first_name LIKE '%${cleanSearch}%' 
                              OR u.last_name LIKE '%${cleanSearch}%')) > 0`
                            ),
                            ...(search.includes(' ')
                                ? (() => {
                                    const [firstName, lastName] = search.split(' ').map(s => String(s || '').replace(/'/g, "''"));
                                    return [
                                        db.sequelize.literal(
                                            `(SELECT COUNT(*) FROM ${uTable} u
                                      WHERE u.id${castText} = ${pTable}.scanned_by 
                                      AND u.first_name LIKE '%${firstName}%'
                                      AND u.last_name LIKE '%${lastName}%') > 0`
                                        ),
                                    ];
                                })()
                                : []),
                        ],
                    },
                ],
            }),
        };


        const query = {
            where: searchConditions,
            order: [[db.sequelize.literal(sort[0]), sort[1]]], // Apply sorting
            include: [
                {
                    model: db.pick,
                    include: [
                        {
                            model: db.files,
                            as: 'pick_text_file'
                        },
                    ],
                },
                { model: db.files, as: 'put_text_file', foreignKey: 'text_file_id' },
                { model: db.files, as: 'put_po_file', foreignKey: 'po_file_id' },
                { model: db.handling_unit, required: false, include: [{ model: db.bin_type, required: false }] },
                { model: db.compartment, required: false }
            ],
            attributes: {
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} u WHERE u.id${castText} = ${pTable}.scanned_by)`
                        ),
                        'user_first_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} u WHERE u.id${castText} = ${pTable}.scanned_by)`
                        ),
                        'user_last_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} u WHERE u.id${castText} = ${pTable}.scanned_by)`
                        ),
                        'user_id',
                    ],
                ],
            }
        }

        if (!isExport) {
            query.offset = pageNumber * pageSize;
            query.limit = pageSize;
        } else {
            query.limit = Math.min(Number(size) || 10000, 10000);
        }

        // Query the database with search, pagination, and sorting
        const results = await db.put.findAndCountAll(query);

        if (isExport) {
            // Generate Excel File for Export
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data Sheet');

            if (results?.rows?.length > 0) {
                const data = results.rows.map((entry) => ({
                    serial_number: entry?.serial_number,
                    model_number: entry?.model_number,
                    scanned_at: entry?.scanned_at,
                    scanned_by: entry?.scanned_by,
                    birth_date: entry?.birth_date,
                    pick_status: entry?.pick_status,
                    put_po_file: entry?.put_po_file?.name,
                    pv_status: entry?.pv_status,
                    put_text_file: entry?.put_text_file?.name,
                    pick_text_file: entry.pick?.pick_text_file?.name,
                }));

                const columns = Object.keys(data[0]);

                worksheet.columns = columns.map((col) => ({
                    key: col.trim(),
                    header: col.trim(),
                }));

                data?.forEach((row) => {
                    worksheet.addRow(row);
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            // Set headers and send the file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=DataSheet.xlsx');

            return res.send(buffer);
        }

        // Prepare response with pagination metadata
        res.json({
            totalItems: results.count,
            totalPages: Math.ceil(results.count / pageSize),
            page: parseInt(page, 10),
            data: results.rows,
        });
    } catch (error) {
        console.error('Error in search API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

})


exports.updatePut = asyncHandler(async (req, res) => {
    try {
        const put = await db.put.findByPk(req.params.id);
        if (!put) return res.status(404).json({ error: 'Put not found' });
        await put.update(req.body);
        res.status(200).json(put);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


exports.deletePut = asyncHandler(async (req, res) => {
    try {
        const put = await db.put.findByPk(req.params.id);
        if (!put) return res.status(404).json({ error: 'Put not found' });
        await put.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

exports.getPut = asyncHandler(async (req, res) => {
    try {
        const put = await db.put.findByPk(req.params.id);
        if (!put) return res.status(404).json({ error: 'Put not found' });
        res.status(200).json(put);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

exports.getUndownloadedPuts = asyncHandler(async (req, res) => {
    const { quantity } = req.body;

    if (!quantity || isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Invalid quantity.' });
    }

    try {
        // Fetch the first 'quantity' records where 'text_file_downloaded' is false, sorted by 'scanned_at' DESC
        const puts = await db.put.findAll({
            where: { text_file_downloaded: false, text_file_id: { [Op.ne]: null } },
            order: [['scanned_at', 'DESC']],
            limit: Number(quantity),
        });

        if (quantity > puts?.length) {
            return res.status(400).json({ message: `Only ${puts?.length}/${quantity} files is availbale to download.` });
        }

        if (!puts || puts.length === 0) {
            return res.status(404).json({ message: 'No files found to download.' });
        }

        const content = `${puts.map((pt) => (`Put_Order${pt.id}|${pt?.serial_number}|${pt?.model_number}|1`))?.join('\n')}`;

        res.setHeader('Content-Disposition', 'attachment; filename="orders.txt"');
        res.setHeader('Content-Type', 'text/plain');

        for (const pt of puts) {
            await pt.update({ text_file_downloaded: true });
        }

        // Send the text content as a response
        return res.send(content);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


function createDateFromString(dateString) {
    // Try to create a Date object from the string
    const date = new Date(dateString);

    // Check if the Date object is valid
    if (isNaN(date.getTime())) {
        return null
    }

    return date;
}

exports.downloadFile = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Invalid quantity.' });
    }
    const put = await db.put.findByPk(id, { include: { model: db.files, foreignKey: 'text_file_id', as: 'put_text_file' } });

    if (!put) {
        return res.status(404).json({ message: 'Put not found' });
    }

    if (!put.put_text_file) {
        return res.status(404).json({ message: 'No file found for this put.' });
    }

    const fileName = put.put_text_file?.name;

    // Search all candidate locations where the file may reside
    const candidatePaths = [
        put.put_text_file?.path ? path.resolve(put.put_text_file.path) : null,
        path.resolve(`uploads/files/put/${fileName}`),
        path.resolve(`uploads/files/pick/${fileName}`),
        path.resolve('uploads', 'files', 'put', fileName),
        path.resolve('uploads', 'files', 'pick', fileName),
        process.env.Put_Text_File_Path ? path.resolve(process.env.Put_Text_File_Path, fileName) : null,
        process.env.Pick_Text_File_Path ? path.resolve(process.env.Pick_Text_File_Path, fileName) : null,
    ].filter(Boolean);

    const filePath = candidatePaths.find(p => fs.existsSync(p));

    if (!filePath) {
        return res.status(404).send({ error: 'File cannot be downloaded' });
    }

    await put.update({ text_file_downloaded: true });

    res.setHeader('File-Name', encodeURIComponent(fileName));

    // Send the file for download
    res.download(filePath, fileName, (err) => {
        if (err) {
            res.status(500).send({ error: 'Error downloading file' });
        }
    });
});
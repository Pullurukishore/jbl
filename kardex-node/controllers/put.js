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


exports.createPut = asyncHandler(async (req, res) => {
    const startTime = moment().format('MM/DD/YYYY hh:mm:ss A');
    const progressTimeline = ['FETCH_DETAILS', 'CHECK_STATUS', 'PASS_FAIL', 'FIND_CSV', 'FIND_MODEL', 'MODEL_FOUND/NOTFOUND', 'CHECKING_AVAILABILITY', 'FILE_GENERATED'];
    let activeProgressStep = 0;
    const serialNumber = req.params?.serialNumber?.trim();
    const process_id = uuid4();

    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        const logs = [];

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

        const isKanbanIn = boardHistoryResponse.data.some((part) => (
            part.Test_Process?.toUpperCase()?.trim() === 'KANBAN_IN / KANBAN_IN'
        ));
        const isKanbanOut = boardHistoryResponse.data.some((part) => (
            part.Test_Process?.toUpperCase()?.trim() === 'KANBAN_OUT / KANBAN_OUT'
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

        let existingPart = null;
        let testProcess = 'KANBAN_IN';

        if (isKanbanIn && isKanbanOut) {
            testProcess = 'KANBAN_RTN';
        }
        else {
            existingPart = await db.put.findOne({ where: { serial_number: serialNumber } });
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

        const birthProcess = boardHistoryResponse.data.find(
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

            results = await parseTextFile(latestFile.path);
            if (results?.isError) {
                logs.push(await createAndSendLog({
                    entity_number: serialNumber,
                    activity: 'FIND_MODEL',
                    status: 'FAILED',
                    message: `Error while parsing PO file. (${results.error?.message})`,
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
            Number(prt['Open GR']) > 0
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
                message: 'Model number NOT available in PO File.',
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

        logs.push(await createAndSendLog({
            entity_number: serialNumber,
            activity: 'CHECKING_AVAILABILITY',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PUT_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

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
                activity: 'FILE_GENERATED',
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
                activity: 'FILE_GENERATED',
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
            const poUploadPath = path.join('uploads', 'files', 'source-po', latestFile.name);
            fs.copyFileSync(latestFile.path, poUploadPath);
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
        /**Latest Source CSV File upload */

        const genFileName = `kardex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`;
        const filePath = path.join(process.env.Put_Text_File_Path, genFileName);

        // Ensure directories exist
        if (!fs.existsSync(process.env.Put_Text_File_Path)) {
            fs.mkdirSync(process.env.Put_Text_File_Path, { recursive: true });
        }

        const lastEntry = await db.put.findOne({
            order: [['id', 'DESC']], // Order by date_of_upload in descending order
        });
        const formattedDate = moment().format('DD.MM.YYYY HH:mm:ss');
        const content = `Put_Order${(lastEntry?.id || 0) + 1}|${birthProcess?.SerialNumber}|${birthProcess?.Number}|${formattedDate}|1`;
        fs.writeFileSync(filePath, content, 'ascii');
        const uploadDir = path.join('uploads', 'files', 'put');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const uploadFilePath = path.join(uploadDir, genFileName);
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

        let putEntry = existingPart;
        if (putEntry?.id) {
            await putEntry.update({ process_status: testProcess, pick_status: 'AVAILABLE' });
        }
        else {
            putEntry = await db.put.create({
                serial_number: birthProcess?.SerialNumber,
                birth_date: createDateFromString(birthProcess?.StartDateTime),
                pv_status: 'PASS',
                process_status: testProcess,
                po_file_id: savedCsvFile?.id,
                model_number: birthProcess?.Number,
                scanned_by: req?.user?.id,
                text_file_id: newFile.id,
                pick_status: 'AVAILABLE'
            });
        }
        logs.push(await createAndSendLog({
            entity_number: birthProcess?.SerialNumber,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
            message: `File ${genFileName} generated and Serial Number processed successfully.`,
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
    const saved = await db.log.create(log);
    res.write(`data: ${JSON.stringify({ ...log, ...saved.get(), completed: true })}\n\n`);
    res.flush();
    return saved;
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
            page = 1, // Default to page 0
            size = 5, // Default to 10 entries per page
            partNumber, // Optional filter
            quantity = 0, // Limit on the maximum number of entries
        } = req.body;

        const where = {
            [db.Sequelize.Op.or]: [
                { model_number: partNumber },
                { serial_number: partNumber }
            ],
            pick_id: null
        };
        // Ensure `size` does not exceed `maxLimit`
        const limit = Math.min(size, quantity);
        const offset = (page - 1) * limit;

        const totalCount = await db.put.count({ where });
        const adjustedCount = Math.min(totalCount, quantity);

        // Fetch paginated rows
        const rows = await db.put.findAll({
            where,
            order: [['birth_date', 'ASC']],
            limit,
            offset
        });

        // Return paginated results
        res.status(200).json({
            message: adjustedCount > 0 ? (quantity > adjustedCount ? 'Available Quantity is less than than the required quantity.' : null) : 'No serial numbers found for this model number.',
            data: rows,
            page: page,
            totalPages: Math.ceil(adjustedCount / limit), // Pages based on adjusted count
            totalItems: adjustedCount, // Capped by maxLimit
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
                                `(SELECT COUNT(*) FROM ${uTable} 
                              WHERE ${uTable}.id${castText} = ${pTable}.scanned_by 
                              AND (${uTable}.first_name LIKE '%${search}%' 
                              OR ${uTable}.last_name LIKE '%${search}%')) > 0`
                            ),
                            ...(search.includes(' ')
                                ? (() => {
                                    const [firstName, lastName] = search.split(' ');
                                    return [
                                        db.sequelize.literal(
                                            `(SELECT COUNT(*) FROM ${uTable} 
                                      WHERE ${uTable}.id${castText} = ${pTable}.scanned_by 
                                      AND ${uTable}.first_name LIKE '%${firstName}%'
                                      AND ${uTable}.last_name LIKE '%${lastName}%') > 0`
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
                { model: db.files, as: 'put_po_file', foreignKey: 'po_file_id' }
            ],
            attributes: {
                include: [
                    [
                        db.sequelize.literal(
                            `(SELECT first_name FROM ${uTable} WHERE ${uTable}.id${castText} = ${pTable}.scanned_by)`
                        ),
                        'user_first_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT last_name FROM ${uTable} WHERE ${uTable}.id${castText} = ${pTable}.scanned_by)`
                        ),
                        'user_last_name',
                    ],
                    [
                        db.sequelize.literal(
                            `(SELECT user_id FROM ${uTable} WHERE ${uTable}.id${castText} = ${pTable}.scanned_by)`
                        ),
                        'user_id',
                    ],
                ],
            }
        }

        if (!isExport) {
            query.offset = pageNumber * pageSize;
            query.limit = pageSize;
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
            page: pageNumber,
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
    // Fetch the first 'quantity' records where 'text_file_downloaded' is false, sorted by 'scanned_at' DESC
    const put = await db.put.findByPk(id, { include: { model: db.files, foreignKey: 'text_file_id', as: 'put_text_file' } });

    if (!put) {
        return res.status(404).json({ message: 'Put not found' });
    }

    if (!put.put_text_file) {
        return res.status(404).json({ message: 'No file found for this put.' });
    }

    if (put.text_file_downloaded) {
        return res.status(400).json({ message: 'Text was file already downloaded.' });
    }

    const fileName = put.put_text_file?.name;
    const filePath = path.resolve(`uploads/files/put/${fileName}`);

    // Check if the file existsput.text_file_downloaded?.name
    if (!fs.existsSync(filePath)) {
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
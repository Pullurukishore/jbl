const asyncHandler = require('express-async-handler');
const db = require('../models');
const fs = require("fs");
const uuid4 = require('uuid4');
const path = require('path');
const { Op } = require('sequelize');
const { getPVStatusCheck, getWipBySerialNumber, updateBoardHistory } = require('../utils/api-call');
const moment = require('moment');


exports.createPick = asyncHandler(async (req, res) => {
    const startTime = moment().format('MM/DD/YYYY hh:mm:ss A');
    const progressTimeline = ['FETCH_DETAILS', 'CHECK_QTY', 'CHECK_STATUS', 'FILE_GENERATED'];
    let activeProgressStep = 0;
    const process_id = uuid4();
    const { modelNumber, qty } = req.params;
    const quantity = Number(qty);
    const logs = [];

    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        if (quantity > 20) {
            return res.end();
        }

        let dataFromDb = await db.put.findAll({ where: { model_number: modelNumber, pick_id: null }, order: [['birth_date', 'ASC']] }) || [];

        if (dataFromDb?.length < quantity) {
            logs.push(await createAndSendLog({
                entity_number: modelNumber,
                activity: 'FETCH_DETAILS',
                status: 'FAILED',
                message: `Insufficient Quantity available.(${dataFromDb?.length}/${quantity})`,
                logged_by: req.user?.id,
                log_type: 'PICK_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res));
            return res.end();
        }

        let validSerialNumbers = [];

        for (const putEntry of dataFromDb) {
            const pvStatusResponse = await getPVStatusCheck(putEntry.serial_number, 'KANBAN_OUT');
            if (pvStatusResponse?.isError) {
                logs.push(await createAndSendLog({
                    entity_number: modelNumber,
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
            await putEntry.update({ pv_status: pvStatusResponse === 'PASS' ? 'PASS' : 'FAIL' });
            if (pvStatusResponse !== 'PASS') {
                continue;
            }
            const getWipSerialRespone = await getWipBySerialNumber(putEntry.serial_number);
            if (getWipSerialRespone?.isError) {
                logs.push(await createAndSendLog({
                    entity_number: modelNumber,
                    activity: 'FETCH_DETAILS',
                    status: 'FAILED',
                    message: `Get WIP API Failed. ${getWipSerialRespone?.error?.message ? `(${getWipSerialRespone?.error?.message})` : ''}`,
                    logged_by: req.user?.id,
                    log_type: 'PICK_PROCESS',
                    user_first_name: req.user?.first_name,
                    user_last_name: req.user?.last_name,
                    user_id: req.user?.user_id,
                    process_id
                }, res));
                return res.end();
            }
            const isOnHold = getWipSerialRespone.data?.CurrentlyOnHold;
            await putEntry.update({ pick_status: isOnHold ? 'HOLD' : putEntry.pick_status });
            if (!isOnHold) {
                validSerialNumbers.push(putEntry);
            }
            if (validSerialNumbers.length === quantity) {
                break;
            }
        }

        logs.push(await createAndSendLog({
            entity_number: modelNumber,
            activity: 'FETCH_DETAILS',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        if (validSerialNumbers?.length !== quantity) {
            logs.push(await createAndSendLog({
                entity_number: modelNumber,
                activity: 'CHECK_QTY',
                status: 'FAILED',
                message: `Insufficient Quantity available.(${validSerialNumbers.length}/${quantity})`,
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
            entity_number: modelNumber,
            activity: 'CHECK_QTY',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;

        logs.push(await createAndSendLog({
            entity_number: modelNumber,
            activity: 'CHECK_STATUS',
            status: 'SUCCESS',
            logged_by: req.user?.id,
            log_type: 'PICK_PROCESS',
            user_first_name: req.user?.first_name,
            user_last_name: req.user?.last_name,
            user_id: req.user?.user_id,
            process_id
        }, res));
        activeProgressStep++;


        let updatedEntries = [];
        for (const putEntry of validSerialNumbers) {
            const updateResponse = await updateBoardHistory({
                serialNumber: putEntry.serial_number,
                processName: 'KANBAN_OUT',
                userId: req.user?.user_id,
                startTime: startTime,
                endTime: moment().format('MM/DD/YYYY hh:mm:ss A'),
                result: 'P'
            });
            if (!updateResponse.isError || updateResponse !== 'Pass') {
                updatedEntries.push(putEntry);
            }
        }

        const genFileName = `kardex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`;
        const filePath = `${process.env.Pick_Text_File_Path}\\${genFileName}`;

        const contentArray = await Promise.all(
            updatedEntries.map(async (putEntry) => {
                await putEntry.update({ pick_status: 'PICKED', process_status: 'KANBAN_OUT' });
                return `Pick_Order${(putEntry?.id || 0) + 1}|${putEntry?.serial_number}|${putEntry?.model_number}|1`;
            })
        );


        const content = contentArray.join('\n');


        fs.writeFileSync(filePath, content);
        const uploadFilePath = path.resolve('uploads', 'files', 'pick', genFileName);
        fs.writeFileSync(uploadFilePath, content);
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
            quantity: quantity,
            process_status: 'KANBAN_OUT',
            entered_by: req.user?.id,
            text_file_id: newFile.id
        });
        await savedPickEntry.setPuts(updatedEntries);

        logs.push(await createAndSendLog({
            entity_number: modelNumber,
            activity: 'FILE_GENERATED',
            status: 'SUCCESS',
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
        const activeStep = progressTimeline[activeProgressStep];
        if (activeStep) {
            await createAndSendLog({
                entity_number: modelNumber,
                activity: activeStep,
                status: 'FAILED',
                message: err?.message || err,
                logged_by: req.user?.id,
                log_type: 'PICK_PROCESS',
                user_first_name: req.user?.first_name,
                user_last_name: req.user?.last_name,
                user_id: req.user?.user_id,
                process_id
            }, res);
        }
        return res.end();
    }
});

async function createAndSendLog(log, res) {
    const saved = await db.log.create(log);
    res.write(`data: ${JSON.stringify({ ...log, ...saved.get(), completed: true })} \n\n`);
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
            order: [[db.sequelize.literal(sort[0]), sort[1]]],
            limit,
            offset,
            include: [
                {
                    model: db.pick,
                    attributes: ['text_file'],
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

        const content = puts.map((pt) => (`Pick_Order${pt.id}|${pt?.serial_number}|${pt?.model_number}|1`))?.join('\n');

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
    // Fetch the first 'quantity' records where 'text_file_downloaded' is false, sorted by 'scanned_at' DESC
    const pick = await db.pick.findByPk(id, { include: [{ model: db.files, foreignKey: 'text_file_id', as: 'pick_text_file' }, { model: db.put }] });

    if (!pick) {
        return res.status(404).json({ message: 'Pick not found' });
    }

    if (!pick.pick_text_file) {
        return res.status(404).json({ message: 'No file found for this pick.' });
    }

    if (pick.text_file_downloaded) {
        return res.status(400).json({ message: 'Text was file already downloaded.' });
    }

    const fileName = pick.pick_text_file?.name;
    const filePath = path.resolve(`uploads/files/pick/${fileName}`);

    // Check if the file existsput.text_file_downloaded?.name
    if (!fs.existsSync(filePath)) {
        return res.status(404).send({ error: 'File cannot be downloaded' });
    }

    await pick.update({ text_file_downloaded: true });
    for (const put of pick?.puts) {
        await put.update({ pick_file_downloaded: true });
    }

    res.setHeader('File-Name', encodeURIComponent(fileName));
    // Send the file for download
    res.download(filePath, fileName, (err) => {
        if (err) {
            res.status(500).send({ error: 'Error downloading file' });
        }
    });
});

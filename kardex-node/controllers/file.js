const path = require('path');
const fs = require('fs');
const db = require('../models');
const asyncHandler = require('express-async-handler');


// Define route to handle file uploads
exports.downloadFile = asyncHandler(async(req, res) => {
    const fileId = req.body?.fileId || req.body?.id;

    if (!fileId) {
        return res.status(400).send({ error: 'File ID is required.' });
    }

    const file = await db.files.findByPk(fileId);

    if (!file) {
        return res.status(404).send({ error: 'File not found' });
    }

    // Construct and validate the full path to the file to prevent directory traversal
    const filePath = path.resolve(file.path);
    const allowedBase = path.resolve('uploads');
    const customPutDir = process.env.Put_Text_File_Path ? path.resolve(process.env.Put_Text_File_Path) : null;
    const customPickDir = process.env.Pick_Text_File_Path ? path.resolve(process.env.Pick_Text_File_Path) : null;

    const isAllowed = filePath.startsWith(allowedBase) ||
        (customPutDir && filePath.startsWith(customPutDir)) ||
        (customPickDir && filePath.startsWith(customPickDir));

    if (!isAllowed) {
        return res.status(403).json({ error: 'Access denied: Unauthorized file path.' });
    }

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send({ error: 'File not found' });
    }

    const safeDownloadName = path.basename(file.name || 'download');

    // Send the file for download
    res.download(filePath, safeDownloadName, (err) => {
        if (err) {
            res.status(500).send({ error: 'Error downloading file' });
        }
    });
});
const path = require('path');
const fs = require('fs');
const db = require('../models');
const asyncHandler = require('express-async-handler');


// Define route to handle file uploads
exports.downloadFile = asyncHandler(async(req, res) => {
    const { fileId } = req.body;

    if (!fileId) {
        return res.status(404).send({ error: 'No body present.' });
    }

    const file = await db.files.findByPk(fileId);

    if (!file) {
        return res.status(404).send({ error: 'File not found' });
    }

    // Construct the full path to the file
    const filePath = path.resolve(`${file.path}`);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send({ error: 'File not found' });
    }

    // Send the file for download
    res.download(filePath, file.name, (err) => {
        if (err) {
            res.status(500).send({ error: 'Error downloading file' });
        }
    });
});
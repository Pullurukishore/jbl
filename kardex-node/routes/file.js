const { downloadFile } = require('../controllers/file');
const express = require('express');

const router = express.Router();

router.post('/download', downloadFile);

module.exports = router;


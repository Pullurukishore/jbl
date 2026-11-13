const express = require('express');
const router = express.Router();
const {
    getMaterialStats,
    getMaterialSummary,
    getMaterialDetails,
    getMaterialSerials
} = require('../controllers/material');

router.get('/stats', getMaterialStats);
router.post('/summary', getMaterialSummary);
router.get('/:modelNumber/details', getMaterialDetails);
router.post('/:modelNumber/serials', getMaterialSerials);

module.exports = router;


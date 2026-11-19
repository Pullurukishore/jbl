const express = require('express');
const router = express.Router();
const {
    getAgingStats,
    getSerialAgingList,
    getKanbanAgingList,
    getAgingExportData
} = require('../controllers/report');

// Aging Dashboard Metrics & Bucket Statistics
router.get('/aging/stats', getAgingStats);

// Serial Number Aging Grid
router.post('/aging/serial', getSerialAgingList);

// Kanban In Aging Check Grid
router.post('/aging/kanban', getKanbanAgingList);

// Excel Export Data Extraction
router.post('/aging/export', getAgingExportData);

module.exports = router;

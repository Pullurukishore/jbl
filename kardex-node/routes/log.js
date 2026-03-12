const express = require("express");
const router = express.Router();
const { createLog, updateLog, deleteLog, getLog, getAll, getLastLogsByType, getLogsByForPart, getByPickId, getByPutId, getChartData } = require("../controllers/log");

router.post('/create', createLog);
router.put('/update/:id', updateLog);
router.delete('/delete/:id', deleteLog);
router.delete('/get/:id', getLog);
router.post('/get-all', getAll);
router.post('/get-latest-by-type', getLastLogsByType);
router.post('/get-all-for-part', getLogsByForPart);
router.post('/get-by-pick-id', getByPickId);
router.post('/get-by-put-id', getByPutId);
router.post('/get-chart-data', getChartData);

module.exports = router;

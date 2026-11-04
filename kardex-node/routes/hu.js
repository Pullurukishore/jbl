const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/hu");

// Bin Types
router.get('/bin-types', ctrl.getBinTypes);
router.post('/bin-types', ctrl.createBinType);
router.put('/bin-types/:id', ctrl.updateBinType);
router.delete('/bin-types/:id', ctrl.deleteBinType);

// HU Management — static routes MUST come before /:huId dynamic routes
router.post('/register', ctrl.registerHU);
router.post('/list', ctrl.getAllHUs);
router.get('/draft', ctrl.getDraftHUs);
router.get('/in-kardex', ctrl.getInKardexHUs);
router.get('/empty', ctrl.getEmptyHUs);
router.get('/partial', ctrl.getPartialHUs);
// Material pick confirmation — must be before /:huId to avoid route conflict
router.post('/confirm-material-pick', ctrl.confirmMaterialPick);
router.get('/:huId/layout', ctrl.getLayout);

// Compartment operations
// GET version for SSE via browser EventSource (connectSSE uses GET)
router.get('/:huId/scan/:compartmentNumber/:serialNumber', ctrl.scanCompartmentGet);
// POST version (kept for direct API calls)
router.post('/:huId/scan', ctrl.scanCompartment);
router.delete('/:huId/compartment/:num/clear', ctrl.clearCompartment);
router.post('/:huId/compartment/:num/pick', ctrl.pickCompartment);
router.get('/:huId/pick-scan/:serialNumber', ctrl.pickScanGet);
router.post('/:huId/pick-all', ctrl.pickAllCompartments);

// Kardex operations
router.post('/:huId/send-to-kardex', ctrl.sendToKardex);
router.post('/:huId/send-pick-to-kardex', ctrl.sendPickToKardex);
router.post('/:huId/confirm-put', ctrl.confirmPut);
router.post('/:huId/hu-pick', ctrl.generateHUPick);
router.post('/:huId/confirm-retrieval', ctrl.confirmRetrieval);

module.exports = router;

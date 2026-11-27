const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/hu");
const { requireAccess, authorize } = require("../middleware/auth");

// Bin Types
router.get('/bin-types', ctrl.getBinTypes);
router.post('/bin-types', authorize('ADMIN'), ctrl.createBinType);
router.put('/bin-types/:id', authorize('ADMIN'), ctrl.updateBinType);
router.delete('/bin-types/:id', authorize('ADMIN'), ctrl.deleteBinType);

// HU Management — static routes MUST come before /:huId dynamic routes
router.post('/register', requireAccess('PUT'), ctrl.registerHU);
router.post('/list', ctrl.getAllHUs);
router.get('/draft', ctrl.getDraftHUs);
router.get('/in-kardex', ctrl.getInKardexHUs);
router.get('/empty', ctrl.getEmptyHUs);
router.get('/partial', ctrl.getPartialHUs);
// Material pick confirmation — must be before /:huId to avoid route conflict
router.post('/confirm-material-pick', requireAccess('PICK'), ctrl.confirmMaterialPick);
router.get('/:huId/layout', ctrl.getLayout);
router.put('/:huId/specification', authorize('ADMIN'), ctrl.updateHUSpecification);
router.delete('/:huId', authorize('ADMIN'), ctrl.deleteHU);

// Compartment operations
// GET version for SSE via browser EventSource (connectSSE uses GET)
router.get('/:huId/scan/:compartmentNumber/:serialNumber', requireAccess('PUT'), ctrl.scanCompartmentGet);
// POST version (kept for direct API calls)
router.post('/:huId/scan', requireAccess('PUT'), ctrl.scanCompartment);
router.delete('/:huId/compartment/:num/clear', requireAccess('PUT'), ctrl.clearCompartment);
router.post('/:huId/compartment/:num/pick', requireAccess('PICK'), ctrl.pickCompartment);
router.get('/:huId/pick-scan/:serialNumber', requireAccess('PICK'), ctrl.pickScanGet);
router.post('/:huId/pick-all', requireAccess('PICK'), ctrl.pickAllCompartments);

// Kardex operations
router.post('/:huId/send-to-kardex', requireAccess('PUT'), ctrl.sendToKardex);
router.post('/:huId/send-pick-to-kardex', requireAccess('PICK'), ctrl.sendPickToKardex);
router.post('/:huId/confirm-put', requireAccess('PUT'), ctrl.confirmPut);
router.post('/:huId/hu-pick', requireAccess('PICK'), ctrl.generateHUPick);
router.post('/:huId/hu-pick-download', requireAccess('PICK'), ctrl.downloadHUPickFile);
router.get('/:huId/hu-pick-download', requireAccess('PICK'), ctrl.downloadHUPickFile);
router.post('/:huId/confirm-retrieval', requireAccess('PICK'), ctrl.confirmRetrieval);

module.exports = router;

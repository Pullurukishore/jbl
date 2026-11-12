const express = require("express");
const router = express.Router();
const { createPut, updatePut, deletePut, getPut, getAll, findByModelAndQty, searchAll, getUndownloadedPuts, downloadFile } = require("../controllers/put");
const { requireAccess } = require("../middleware/auth");

router.get('/create/:serialNumber', requireAccess('PUT'), createPut);
router.put('/update/:id', requireAccess('PUT'), updatePut);
router.delete('/delete/:id', requireAccess('PUT'), deletePut);
router.delete('/get/:id', getPut);
router.get('/get-all', getAll);
router.post('/search-all', searchAll);
router.post('/get-undownoaded', getUndownloadedPuts);
router.post('/download-text-file', requireAccess('PUT'), downloadFile);
router.post('/find-by-model-and-qty', findByModelAndQty);


module.exports = router;

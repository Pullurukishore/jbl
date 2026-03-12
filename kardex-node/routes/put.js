const express = require("express");
const router = express.Router();
const { createPut, updatePut, deletePut, getPut, getAll, findByModelAndQty, searchAll, getUndownloadedPuts, downloadFile } = require("../controllers/put");

router.get('/create/:serialNumber', createPut);
router.put('/update/:id', updatePut);
router.delete('/delete/:id', deletePut);
router.delete('/get/:id', getPut);
router.get('/get-all', getAll);
router.post('/search-all', searchAll);
router.post('/get-undownoaded', getUndownloadedPuts);
router.post('/download-text-file', downloadFile);
router.post('/find-by-model-and-qty', findByModelAndQty);


module.exports = router;

const express = require("express");
const router = express.Router();
const { createPick, updatePick, deletePick, getPick, getAll, getUndownloadedPicks, downloadFile } = require("../controllers/pick");

router.get('/create/:modelNumber/:qty', createPick);
router.put('/update/:id', updatePick);
router.get('/get-all', getAll);
router.delete('/delete/:id', deletePick);
router.delete('/get/:id', getPick);
router.post('/get-undownoaded', getUndownloadedPicks);
router.post('/download-text-file', downloadFile);


module.exports = router;

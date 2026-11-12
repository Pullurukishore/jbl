const express = require("express");
const router = express.Router();
const { createPick, updatePick, deletePick, getPick, getAll, getUndownloadedPicks, downloadFile } = require("../controllers/pick");
const { requireAccess } = require("../middleware/auth");

router.get('/create/:modelNumber/:qty', requireAccess('PICK'), createPick);
router.put('/update/:id', requireAccess('PICK'), updatePick);
router.get('/get-all', getAll);
router.delete('/delete/:id', requireAccess('PICK'), deletePick);
router.delete('/get/:id', getPick);
router.post('/get-undownoaded', getUndownloadedPicks);
router.post('/download-text-file', requireAccess('PICK'), downloadFile);


module.exports = router;

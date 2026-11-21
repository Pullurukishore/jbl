const express = require("express");
const router = express.Router();
const { createPick, createBinPick, getPickPlan, updatePick, deletePick, getPick, getAll, getUndownloadedPicks, downloadFile, validateSerialForPick } = require("../controllers/pick");
const { requireAccess } = require("../middleware/auth");

router.post('/plan', requireAccess('PICK'), getPickPlan);
router.get('/create-bin/:huId/:modelNumber/:qty', requireAccess('PICK'), createBinPick);
router.get('/create/:modelNumber/:qty', requireAccess('PICK'), createPick);
router.post('/validate-serial', requireAccess('PICK'), validateSerialForPick);
router.put('/update/:id', requireAccess('PICK'), updatePick);
router.get('/get-all', getAll);
router.delete('/delete/:id', requireAccess('PICK'), deletePick);
router.get('/get/:id', getPick);
router.post('/get-undownloaded', getUndownloadedPicks);
router.post('/get-undownoaded', getUndownloadedPicks);
router.post('/download-text-file', requireAccess('PICK'), downloadFile);

module.exports = router;

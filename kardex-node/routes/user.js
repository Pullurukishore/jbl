const express = require("express");
const router = express.Router();
const { createUser, updateUser, deleteUser, getUser, getAll, changePassword } = require("../controllers/user");
const { authorize } = require("../middleware/auth");

router.post('/create', authorize('ADMIN'), createUser);
router.post('/update/:id', authorize('ADMIN'), updateUser);
router.delete('/delete/:id', authorize('ADMIN'), deleteUser);
router.delete('/get/:id', authorize('ADMIN'), getUser);
router.get('/get-all', authorize('ADMIN'), getAll);
router.post('/change-password', authorize('ADMIN'), changePassword);

module.exports = router;

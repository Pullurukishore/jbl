const express = require("express");
const router = express.Router();
const { getAllCounts } = require("../controllers/dashboard");

router.post('/get-all-counts', getAllCounts);

module.exports = router;
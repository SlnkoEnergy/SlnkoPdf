const express = require("express");
const projectSchedulepdf = require("../controllers/projectSchedule.controllers");

const router = express.Router();

router.post("/project-schedule-pdf", projectSchedulepdf);

module.exports = router;
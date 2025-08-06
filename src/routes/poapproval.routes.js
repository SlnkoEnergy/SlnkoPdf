const express = require('express');
const poapprovalPdf = require('../controllers/poapproval.controllers');

const router = express.Router();
router.post("/Po-pdf", poapprovalPdf);
module.exports = router;
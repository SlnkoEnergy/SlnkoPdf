const express = require('express');
const scopePdf = require('../controllers/scope.controllers');

const router = express.Router();

router.post("/scope-pdf", scopePdf);

module.exports = router;

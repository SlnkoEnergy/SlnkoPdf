const express = require('express');
const expensePdf = require('../controllers/expensePdfControllers');
const router = express.Router();

router.post("/expense-pdf", expensePdf);

module.exports = router;

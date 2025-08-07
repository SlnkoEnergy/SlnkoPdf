const express = require('express');
const paymenthistorypdf = require('../controllers/paymenthistory.controllers');


const router = express.Router();
router.post("/po-history", paymenthistorypdf);
module.exports = router;
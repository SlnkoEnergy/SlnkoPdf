const express = require("express");
const CustomerPaymentpdf = require("../controllers/customerpayment.controller");

const router = express.Router();
router.post("/cu-summary", CustomerPaymentpdf);
module.exports = router;
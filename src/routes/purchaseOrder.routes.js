const express = require("express");
const purchaseOrderPdf = require("../controllers/purchaseOrder.controllers");

const router = express();

router.post("/po-sheet", purchaseOrderPdf);

module.exports = router;

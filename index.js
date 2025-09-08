const express = require("express");
const app = express();
const cors = require("cors");
const { config } = require("dotenv");
const expensePdfRoutes = require("./src/routes/expensePdfRoutes");
const scopePdfRoutes = require("./src/routes/scope.routes"); 
const poapproval = require("./src/routes/poapproval.routes")
const paymenthistory = require ("./src/routes/paymenthistory.routes");
const router = require("./src/routes/customerpaymentroutes");
config({ path: "./.env" });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

const PORT = process.env.PORT;

app.use("/v1/expensePdf", expensePdfRoutes);
app.use("/v1/scopePdf", scopePdfRoutes);
app.use("/v1/po-approve", poapproval);
app.use("/v1/payment-history", paymenthistory );
app.use("/v1/Customer-summary", router);
app.listen(PORT, () => {
  console.log(`Slnko app is running on port ${PORT}`);
});

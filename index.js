const express = require("express");
const app = express();
const cors = require("cors");
const { config } = require("dotenv");
const expensePdfRoutes = require("./src/routes/expensePdfRoutes"); 
config({ path: "./.env" });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

const PORT = process.env.PORT;

app.use("/v1/expensePdf", expensePdfRoutes);

app.listen(PORT, () => {
  console.log(`Slnko app is running on port ${PORT}`);
});
  // "pdf-poppler": "^0.2.1",
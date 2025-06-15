const express = require("express");
const app = express();
const cors = require("cors");
const { config } = require("dotenv");
const expensePdfRoutes = require("./src/routes/expensePdfRoutes"); // updated path if inside src/routes

config({ path: "./.env" });

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT;

app.use("/v1/expensePdf", expensePdfRoutes);

app.listen(PORT, () => {
  console.log(`Slnko app is running on port ${PORT}`);
});

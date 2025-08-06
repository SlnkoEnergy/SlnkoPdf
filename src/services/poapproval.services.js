const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");
const https = require("https");
const http = require("http");
const { PDFDocument } = require("pdf-lib");


async function generatePaymentApprovalSheet(Pos, options = {}) {

    const summaryMap = {};
    let totalAmount = 0;

    (Pos.items || []).forEach((item) => {
        const catagory = item.catagory || "Others";
        const payment = Number(item.amount) || 0;
        if (summaryMap[catagory]) summaryMap[catagory] = { payment: 0 };
        summaryMap[catagory].payment += payment;
        totalAmount += payment;
    });

    const summaryRows = Object.entries(summaryMap)
        .map(([category, amounts]) => `
      <tr>
        <td style="border:1px solid #000; padding:6px; text-align:left;">${category}</td>
        <td style="border:1px solid #000; padding:6px; text-align:right;">${amounts.payment.toFixed(2)}</td>
      </tr>
    `).join("");

    const summaryTotalRow = `
    <tr>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:left;">Total</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalRequested.toFixed(2)}</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalApproved.toFixed(2)}</td>
    </tr>
  `;

    const itemsHTML = (Pos.items || [])
        .map((item, i) => {
            return `
        <tr>
          <td>${i + 1}</td>
          <td>${item.payId}</td>
          <td>${item.request_date ? new Date(item.request_date).toLocaleDateString("en-IN") : "NA"}</td>
          <td>${item.category || "-"}</td>
          <td class="left">${item.description || "-"}</td>
          <td ${item.amount ? item.amount : "NA"} </td>
        </tr>
            `;
        }).join("");

    const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
    const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;


    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .watermark {
          position: fixed;
          top: 50%;
          left: 12%;
          transform: rotate(-45deg);
          font-size: 100px;
          color: rgba(0,0,0,0.05);
          z-index: -1;
        }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .header img { max-height: 50px; max-width: 150px; object-fit: contain; }
        h2.title { text-align: center; margin-bottom: 20px; font-size: 22px; text-transform: uppercase; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info div { width: 32%; font-size: 14px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #000; padding: 6px; text-align: center; }
        td.left { text-align: left; }
        .summary-table { margin-top: 30px; width: 50%; font-size: 12px; margin-left: auto; margin-right: auto; }
      </style>
    </head>
    <body>
      <div class="watermark">Slnko Energy</div>
      <div class="header">
        <img src="${logoSrc}" alt="Slnko Logo" />
      </div>
      <h2 class="title">Payment Approval Sheet</h2>
      <div class="info">
        <div>
          <strong>Project Id:</strong> ${Pos.projectId}<br>
          <strong>Client Name:</strong> ${Pos.client_name}<br>
        </div>
       
        <div>
          <strong>Project Name:</strong> ${Pos.project_name}<br>
          <strong>Group Name:</strong> ${Pos.group_name}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Payment Id</th>
            <th>Requested Date</th>
            <th>Item</th>
            <th>Remark</th>
            <th>Requested Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Requested Amount </th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
          ${summaryTotalRow}
        </tbody>
      </table>
    </body>
    </html>
  `;

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const mainPdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0mm", bottom: "10mm", left: "2mm", right: "2mm" },

    });
    await browser.close();
    return mainPdfBuffer;
}

module.exports = generatePaymentApprovalSheet;
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

async function generatePaymentApprovalSheet(Pos) {
  const summaryMap = {};
  let totalAmount = 0;



  (Pos || []).forEach((po) => {
    const category = po.paid_for || "Others";
    const payment = Number(po.amt_for_customer) || 0;

    if (!summaryMap[category]) summaryMap[category] = { payment: 0 };
    summaryMap[category].payment += payment;
    totalAmount += payment;
  })


  const summaryRows = Object.entries(summaryMap)
    .map(
      ([category, amounts]) => `
      <tr>
        <td style="border:1px solid #000; padding:6px; text-align:left;">${category}</td>
        <td style="border:1px solid #000; padding:6px; text-align:right;">${amounts.payment.toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  const summaryTotalRow = `
    <tr>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:left;">Total</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalAmount.toFixed(2)}</td>
    </tr>
  `;

  const itemsHTML = (Pos || [])
    .map((po, i) => {
      return `
        <tr>
          <td>${i + 1}</td>
          <td>
          <div>${po.project_code}</div>
  <div>${po.project_name}</div>
  <div>${po.group_name}</div>
          </td>
          <td>
          <div> ${po.pay_id}</div>
          <div> ${po.paid_for}</div>
          <div> ${po.vendor}</div>
          </td>
          <td>${po.dbt_date ? new Date(po.dbt_date).toLocaleDateString("en-IN") : "NA"}</td>
          <td class="left">${po.comment || "-"}</td>
          <td>${po.amt_for_customer ? po.amt_for_customer : "NA"}</td>
          <td>${po.po_number ? po.po_number : "N/A"}</td>
        </tr>
      `;
    })
    .join("");

  const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  const checkData = fs.readFileSync(path.resolve(__dirname, "../assets/2.png"));
  const checklogo = `data:image/png;base64, ${checkData.toString("base64")}`;

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
        .header img { max-height: 85px; max-width: 400px; object-fit: contain; }
        h2.title { text-align: center; margin-bottom: 20px; font-size: 22px; text-transform: uppercase; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info div { width: 48%; font-size: 14px; line-height: 1.6; }
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
        <div style="display: flex; flex-direction: column">
        <p style="margin:0; font-size:18px; font-weight:bold;">SLNKO ENERGY PVT LTD</p>
  <p style="margin: 0;">2nd Floor, B58B, Block B,</p>
  <p style="margin: 0;">Sector 60, Noida, Uttar Pradesh 201309</p>
  <p style="margin: 0;">
  mail: <a href="info@slnkoenergy.com">info@slnkoenergy.com</a>
</p>
<p style="margin: 0;">
  web: <a href="https://slnkoprotrac.com" target="_blank">www.slnkoprotrac.com</a>
</p>


</div>
        
      </div>
    <div style="margin-top: 100px;">

  <!-- Title Section -->
  <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 20px;">
    <h2 class="title" style="margin: 0;">Payment Approval Sheet</h2>
    <img src="${checklogo}" alt="check logo" style="height: 20px; width: 20px;" />
  </div>

  <!-- Main Table -->
  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Project Details</th>
        <th>Payment Details</th>
        <th>Requested Date</th>
        <th>Remark</th>
        <th>Requested Amount</th>
        <th>Po Number</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <!-- Summary Table -->
  <table class="summary-table" style="margin-top: 15px;">
    <thead>
      <tr>
        <th>Item</th>
        <th>Requested Amount</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
      ${summaryTotalRow}
    </tbody>
  </table>

</div>

      <div style="margin-top: 100px; text-align: right ;">
  <div style="font-weight: bold; font-size: 18px;">Signature</div>
  <div style="margin-top: 4px; font-size: 18px;  font-weight: bold;">Cam Head</div>
</div>

    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "10mm", left: "2mm", right: "2mm" },
    displayHeaderFooter: true,
    footerTemplate: `
    <div style="font-size:10px; width:100%; text-align:center; color: gray; padding:5px 0;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span> | © SLnko Energy Pvt. Ltd.
    </div>
  `,
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = generatePaymentApprovalSheet;

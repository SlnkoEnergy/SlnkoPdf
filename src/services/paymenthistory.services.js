const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra')


async function generatepaymenthistorySheet(Payments) {

  try {
    const summaryMap = {};
    let totalAmount = 0;

    (Payments || []).forEach((Payment) => {
      const company = Payment.paid_to || "Others";
      const pay = Number(Payment.amount_paid) || 0;

      if (!summaryMap[company]) summaryMap[company] = { pay: 0 };
      summaryMap[company].pay += pay;
      totalAmount += pay;
    });

    const summaryRows = Object.entries(summaryMap)
      .map(
        ([company, amounts]) => `
                <tr>
                    <td style = "border:1px solid #000; padding: 6px; text-align:left;"> ${company} </td>
                    <td style = "border:1px solid #000; padding: 6px; text-align: right;">${amounts.pay.toFixed(2)} </td>
                `
      ).join("");

    const summaryTotalRow = `
                <tr>
                    <td style = "border: 1px solid #000; padding: 6px; font-weight: bold; text-align:left;"> Total </td>
                    <td style = "border: 1px solid #000; padding: 6px; font-weight: bold; text-align:right;">${totalAmount.toFixed(2)}</td>
            `

    const itemsHTML = (Payments || [])
      .map((payment, i) => {
        return `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${payment.debit_date ? new Date(payment.debit_date).toLocaleDateString("en-IN") : "NA"}</td>
                            <td>${payment.po_number}</td>
                            <td>${payment.paid_to}</td>
                            <td>${payment.paid_for}</td>
                            <td>${payment.amount_paid}</td>
                            <td>${payment.utr}</td>
                            <td>${payment.utr_submited ? new Date(payment.utr_submited).toLocaleDateString("en-IN") : "NA"}</td>
                        </tr>
                    `;
      }).join("");

    const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
    const logoSrc = `data:image/png;base64, ${logoData.toString("base64")}`;

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
      <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 20px;">
  <h2 class="title" style="margin: 0;">Payment History Sheet</h2>
</div>

      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Debit Date</th>
            <th>PO Number</th>
            <th>Paid To</th>
            <th>Paid For</th>
            <th>Amount</th>
            <th>UTR</th>
            <th>UTR Submitted</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Paid To</th>
            <th>Amount</th>
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
  } catch (error) {
    console.error(error);
    throw error;
  }

};

module.exports = generatepaymenthistorySheet;

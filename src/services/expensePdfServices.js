const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

async function fetchBase64FromUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (response) => {
      let data = [];
      response
        .on("data", (chunk) => data.push(chunk))
        .on("end", () => {
          const buffer = Buffer.concat(data);
          const contentType = response.headers["content-type"] || "image/png";
          const base64 = buffer.toString("base64");
          resolve(`data:${contentType};base64,${base64}`);
        })
        .on("error", reject);
    }).on("error", reject);
  });
}

async function generateExpenseSheet(sheet, { department, printAttachments, attachmentLinks }) {
  const logoPath = path.resolve(__dirname, "../assets/1.png");
  const logoData = fs.readFileSync(logoPath).toString("base64");
  const logoSrc = `data:image/png;base64,${logoData}`;

  const summaryMap = {};
  let totalApproved = 0;
  let totalRequested = 0;

  (sheet.items || []).forEach((item) => {
    const category = item.category || "Others";
    const approved = Number(item.approved_amount) || 0;
    const requested = Number(item.invoice?.invoice_amount) || 0;

    if (!summaryMap[category]) {
      summaryMap[category] = { approved: 0, requested: 0 };
    }
    summaryMap[category].approved += approved;
    summaryMap[category].requested += requested;

    totalApproved += approved;
    totalRequested += requested;
  });

  const summaryRows = Object.entries(summaryMap)
    .map(([category, amounts]) => {
      return `
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: left;">${category}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">${amounts.requested.toFixed(2)}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: right;">${amounts.approved.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const summaryTotalRow = `
    <tr>
      <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: left;">Total</td>
      <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: right;">${totalRequested.toFixed(2)}</td>
      <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: right;">${totalApproved.toFixed(2)}</td>
    </tr>
  `;

  const itemsHTML = (sheet.items || [])
    .map((item, i) => {
      const projectName = item.project_id?.name || "";
      const projectCode = item.project_id?.code || "";
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${projectCode}</td>
          <td>${projectName}</td>
          <td>${item.category}</td>
          <td class="left">${item.description || "-"}</td>
          <td>${item.expense_date ? new Date(item.expense_date).toLocaleDateString("en-IN") : "-"}</td>
          <td>${item.invoice?.invoice_amount || "-"}</td>
          <td>${item.approved_amount || "-"}</td>
        </tr>
      `;
    })
    .join("");

  const fromDate = new Date(sheet.expense_term.from).toLocaleDateString("en-IN");
  const toDate = new Date(sheet.expense_term.to).toLocaleDateString("en-IN");

  let attachmentsHTML = "";
  if (printAttachments && Array.isArray(attachmentLinks) && attachmentLinks.length > 0) {
    const base64Images = await Promise.all(
      attachmentLinks.map((url) => fetchBase64FromUrl(url).catch(() => null))
    );

    const validImages = base64Images.filter(Boolean);

    const attachmentImagesHTML = validImages
      .map((src) => `
        <div style=" text-align: center;">
          <img src="${src}" style="max-width: 100%; max-height: 1000px;" />
        </div>
      `)
      .join("");

    attachmentsHTML = `
      <div>
        <h3 style="page-break-before: always; text-align: center;">Attachments</h3>
        ${attachmentImagesHTML}
      </div>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 12%;
          transform: rotate(-45deg);
          font-size: 100px;
          color: rgba(0, 0, 0, 0.05);
          z-index: -1;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .header img {
          max-height: 50px;
          max-width: 150px;
          object-fit: contain;
        }
        h2.title {
          text-align: center;
          margin-bottom: 20px;
          font-size: 22px;
          text-transform: uppercase;
        }
        .info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .info div {
          width: 32%;
          font-size: 14px;
          line-height: 1.6;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #000;
          padding: 6px;
          text-align: center;
        }
        td.left {
          text-align: left;
        }
        .summary-table {
          margin-top: 30px;
          width: 50%;
          font-size: 12px;
          margin-left: auto;
          margin-right: auto;
        }
      </style>
    </head>
    <body>
      <div class="watermark">Slnko Energy</div>
      <div class="header">
        <img src="${logoSrc}" alt="Slnko Logo" />
      </div>

      <h2 class="title">Expense Sheet</h2>
      <h2 class="title">${sheet.expense_code}</h2>

      <div class="info">
        <div>
          <strong>Employee Name:</strong> ${sheet.emp_name}<br>
          <strong>Employee Code:</strong> ${sheet.emp_id}<br>
          <strong>Department:</strong> ${department}
        </div>
        <div>
          <strong>Expense Period:</strong><br>
          From: ${fromDate}<br>
          To: ${toDate}
        </div>
        <div>
          <strong>Mobile Number:</strong> ${sheet.user_id.phone}<br>
          <strong>Sheet Current Status:</strong> ${sheet.current_status}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Project Code</th>
            <th>Site Name</th>
            <th>Category</th>
            <th>Description</th>
            <th>Date</th>
            <th>Requested Amount</th>
            <th>Approved Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="summary-table">
        <h3>Summary</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Category Type</th>
              <th>Requested Amount</th>
              <th>Approved Amount</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
            ${summaryTotalRow}
          </tbody>
        </table>
      </div>

      ${attachmentsHTML}
    </body>
    </html>
  `;

  const executablePath = process.env.NODE_ENV === 'production' ? '/usr/bin/chromium' : undefined;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

  const rawPdf = await page.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    margin: {
      top: "10px",
      bottom: "10px",
      left: "10px",
      right: "10px",
    },
  });

  await browser.close();
  return Buffer.from(rawPdf);
}

module.exports = generateExpenseSheet;

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");
const https = require("https");
const http = require("http");
const { PDFDocument } = require("pdf-lib");


async function generateExpenseSheet(sheet, options = {}) {
  const {
    department = "",
    printAttachments = false,
    attachmentLinks = []
  } = options;

  const summaryMap = {};
  let totalApproved = 0;
  let totalRequested = 0;

  (sheet.items || []).forEach((item) => {
    const category = item.category || "Others";
    const approved = Number(item.approved_amount) || 0;
    const requested = Number(item.invoice?.invoice_amount) || 0;
    if (!summaryMap[category]) summaryMap[category] = { approved: 0, requested: 0 };
    summaryMap[category].approved += approved;
    summaryMap[category].requested += requested;
    totalApproved += approved;
    totalRequested += requested;
  });

  const summaryRows = Object.entries(summaryMap)
    .map(([category, amounts]) => `
      <tr>
        <td style="border:1px solid #000; padding:6px; text-align:left;">${category}</td>
        <td style="border:1px solid #000; padding:6px; text-align:right;">${amounts.requested.toFixed(2)}</td>
        <td style="border:1px solid #000; padding:6px; text-align:right;">${amounts.approved.toFixed(2)}</td>
      </tr>
    `).join("");

  const summaryTotalRow = `
    <tr>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:left;">Total</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalRequested.toFixed(2)}</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalApproved.toFixed(2)}</td>
    </tr>
  `;

  const itemsHTML = (sheet.items || [])
    .map((item, i) => {
      const projectName = item.project_name || "";
      const projectCode = item.project_code || "";
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${projectCode}</td>
          <td>${projectName}</td>
          <td>${item.category || "-"}</td>
          <td class="left">${item.description || "-"}</td>
          <td>${item.expense_date ? new Date(item.expense_date).toLocaleDateString("en-IN") : "-"}</td>
          <td>${item.invoice?.invoice_amount ?? "-"}</td>
          <td>${item.approved_amount ?? "-"}</td>
          <td>${item.attachment_url ? "YES" : "NO"}</td>
        </tr>
      `;
    }).join("");

  const fromDate = new Date(sheet.expense_term.from).toLocaleDateString("en-IN");
  const toDate = new Date(sheet.expense_term.to).toLocaleDateString("en-IN");

  const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  let attHTML = "";

  if (printAttachments && attachmentLinks.length) {
    for (const url of attachmentLinks) {
      const isPdf = /\.pdf(\?.*)?$/i.test(url);
      if (isPdf) {
        try {
          const pdfBuffer = await new Promise((resolve, reject) => {
            const lib = url.startsWith("https") ? https : http;
            lib.get(url, (res) => {
              if (res.statusCode !== 200) return reject(new Error(`PDF fetch failed: ${url}`));
              const chunks = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => resolve(Buffer.concat(chunks)));
            }).on("error", reject);
          });

          options.attachments = options.attachments || [];
          options.attachments.push({ type: "pdf", buffer: pdfBuffer });

        } catch (e) {
          console.error("PDF Attachment Error:", e);
        }
      } else {
        attHTML += `<img src="${url}" style="max-width:100%; margin:10px 0;" />`;
      }
    }
  }

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
            <th>Attachment</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Requested</th>
            <th>Approved</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
          ${summaryTotalRow}
        </tbody>
      </table>

      ${attHTML}

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

  if (!options.attachments || options.attachments.length === 0) {
    return mainPdfBuffer;
  }

  const mergedPdfDoc = await PDFDocument.create();

  const mainPdf = await PDFDocument.load(mainPdfBuffer);
  const copiedMainPages = await mergedPdfDoc.copyPages(mainPdf, mainPdf.getPageIndices());
  copiedMainPages.forEach((page) => mergedPdfDoc.addPage(page));

  for (const att of options.attachments) {
    if (att.type === "pdf" && att.buffer) {
      const attPdf = await PDFDocument.load(att.buffer);
      const attPages = await mergedPdfDoc.copyPages(attPdf, attPdf.getPageIndices());
      attPages.forEach((page) => mergedPdfDoc.addPage(page));
    }
  }

  const finalPdfBytes = await mergedPdfDoc.save();
  return Buffer.from(finalPdfBytes);
}

module.exports = generateExpenseSheet;


const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatINR(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return "₹ 0";
  const formatted = n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `&#8377; ${formatted.replace(/\.0+$/, "")}`;
}



function toNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}


async function generatePaymentApprovalSheet(Pos) {
  const rows = Array.isArray(Pos) ? Pos : [];


  const summaryMap = {};
  let totalAmount = 0;

  for (const po of rows) {
    const category = po?.paid_for || "Others";
    const amt = toNumber(po?.amt_for_customer);
    if (!summaryMap[category]) summaryMap[category] = 0;
    summaryMap[category] += amt;
    totalAmount += amt;
  }


  const summaryEntries = Object.entries(summaryMap).sort(([a, av], [b, bv]) => {
    if (a === "Others") return 1;
    if (b === "Others") return -1;
    return bv - av;
  });

  const summaryRows = summaryEntries
    .map(
      ([category, amount]) => `
      <tr>
        <td class="td-left">${escapeHtml(category)}</td>
        <td class="td-right">${formatINR(amount)}</td>
      </tr>`
    )
    .join("");

  const summaryTotalRow = `
    <tr class="total-row">
      <td class="td-left"><strong>Total</strong></td>
      <td class="td-right"><strong>${formatINR(totalAmount)}</strong></td>
    </tr>
  `;


  const itemsHTML = rows
    .slice()
    .sort((a, b) => {
      const ad = a?.dbt_date ? new Date(a.dbt_date).getTime() : 0;
      const bd = b?.dbt_date ? new Date(b.dbt_date).getTime() : 0;
      if (ad !== bd) return ad - bd;
      const ap = `${a?.project_code || ""}${a?.project_name || ""}`.toLowerCase();
      const bp = `${b?.project_code || ""}${b?.project_name || ""}`.toLowerCase();
      return ap.localeCompare(bp);
    })
    .map((po, i) => {
      const projCode = escapeHtml(po?.project_code || "—");
      const projName = escapeHtml(po?.project_name || "—");
      const groupName = escapeHtml(po?.group_name || "—");

      const payId = escapeHtml(po?.pay_id || "—");
      const category = escapeHtml(po?.paid_for || "—");
      const vendor = escapeHtml(po?.vendor || "—");
      const poNumber = escapeHtml(po?.po_number || "N/A");

      const date = po?.dbt_date
        ? new Date(po.dbt_date).toLocaleDateString("en-IN")
        : "NA";

      const remark = escapeHtml(po?.comment || "-");
      const amount = formatINR(toNumber(po?.amt_for_customer));

      return `
        <tr>
          <td>${i + 1}</td>
          <td class="td-left">
            <div class="muted">Project ID:  ${projCode}</div>
            <div><strong>${projName}</strong></div>
            <div class="muted">Group: ${groupName}</div>
          </td>
          <td class="td-left">
            <div class="muted">Pay ID: ${payId}</div>
            <div>Category: ${category}</div>
            <div>Vendor: ${vendor}</div>
            <div>PO: ${poNumber}</div>
          </td>
          <td>${date}</td>
          <td class="td-left">${remark}</td>
          <td class="td-right">${amount}</td>
        </tr>
      `;
    })
    .join("");


  const logoPath = path.resolve(__dirname, "../assets/1.png");
  const checkPath = path.resolve(__dirname, "../assets/2.png");
  const logoSrc = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
    : "";
  const checkSrc = fs.existsSync(checkPath)
    ? `data:image/png;base64,${fs.readFileSync(checkPath).toString("base64")}`
    : "";

  const reportDate = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment Approval Sheet</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 8mm 16mm 8mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Noto Sans", "DejaVu Sans", "Segoe UI Symbol", Arial, Helvetica, sans-serif;
      margin: 0;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container { padding: 12px 16px 0 16px; }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    .logo img { max-height: 70px; max-width: 280px; object-fit: contain; }
    .company {
      text-align: right;
      line-height: 1.35;
      font-size: 12px;
    }
    .company .name { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      font-size: 12px;
      color: #374151;
    }

    /* Title */
    .title-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin: 14px 0 10px;
    }
    .title {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 10%;
    }
    .title-icon { height: 20px; width: 20px;margin-top: 10%; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #1f2937; padding: 6px; text-align: center; vertical-align: top; }
    th {
      background: #f3f4f6;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .td-left { text-align: left; }
    .td-right { text-align: right; }
    .muted { color: #6b7280; font-size: 11px; }

    /* Row behavior for page breaks */
    tr { page-break-inside: avoid; }

    /* Summary table */
    .summary-wrap {
      margin-top: 14px;
      width: 60%;
      margin-left: auto;
    }
    .summary table { width: 100%; }
    .summary .total-row td { background: #f9fafb; }

    /* Footer sign */
    .sign {
      margin-top: 50px;
      text-align: right;
    }
    .sign .label { font-weight: 700; font-size: 14px; }
    .sign .role { margin-top: 2px; font-size: 14px; font-weight: 700; }

    /* Watermark */
    .watermark {
      position: fixed;
      top: 45%;
      left: 12%;
      transform: rotate(-30deg);
      font-size: 90px;
      color: rgba(0,0,0,0.04);
      z-index: -1;
      user-select: none;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="watermark">Slnko Energy</div>
  <div class="container">
    <div class="header">
      <div class="logo">
        ${logoSrc ? `<img src="${logoSrc}" alt="Slnko Logo" />` : ""}
      </div>
      <div class="company">
        <div class="name">SLNKO ENERGY PVT LTD</div>
        <div>2nd Floor, B58B, Block B</div>
        <div>Sector 60, Noida, Uttar Pradesh 201309</div>
        <div>mail: <a href="mailto:info@slnkoenergy.com">info@slnkoenergy.com</a></div>
        <div>web: <a href="https://slnkoprotrac.com" target="_blank">www.slnkoprotrac.com</a></div>
      </div>
    </div>

    <div class="meta">
      <div>Approval Date: <strong>${escapeHtml(reportDate)}</strong></div>
      <div>Total Requested: <strong>${formatINR(totalAmount)}</strong></div>
    </div>

    <div class="title-wrap">
      <h2 class="title">Payment Approval Sheet</h2>
      ${checkSrc ? `<img class="title-icon" src="${checkSrc}" alt="check icon" />` : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">S.No</th>
          <th style="width: 28%;">Project Details</th>
          <th style="width: 28%;">Payment Details</th>
          <th style="width: 100px;">Requested Date</th>
          <th>Remark</th>
          <th style="width: 120px;">Requested Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML || `<tr><td colspan="6" class="td-left">No records found.</td></tr>`}
      </tbody>
    </table>

    <div class="summary-wrap summary">
      <table>
        <thead>
          <tr>
            <th class="td-left">Item</th>
            <th class="td-right">Requested Amount</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
          ${summaryTotalRow}
        </tbody>
      </table>
    </div>

    <div class="sign">
      <div class="label">Signature</div>
      <div class="role">CAM Head</div>
    </div>
  </div>
</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(true);
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "16mm", left: "6mm", right: "6mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="font-size:10px; width:100%; text-align:center; color:#6b7280; padding:6px 0;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span> | © SLNKO Energy Pvt. Ltd.
        </div>
      `,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = generatePaymentApprovalSheet;

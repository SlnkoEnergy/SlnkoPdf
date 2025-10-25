const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

// --- Helpers ---
const titlePreserveAcronyms = (s) => {
  if (!s && s !== 0) return "";
  return String(s)
    .split(/(\s+)/)
    .map((tok) => {
      if (!/[A-Za-z]/.test(tok)) return tok;
      if (tok === tok.toUpperCase()) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    })
    .join("");
};

const prettyStatus = (s) => {
  if (!s) return "";
  const words = String(s).replace(/_/g, " ").trim().split(/\s+/);
  return words
    .map((w) =>
      w.toLowerCase() === "po"
        ? "PO"
        : w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
};

// dd/MM/yyyy
const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

async function generateScopeSheet(scope, options = {}) {
  const {
    project = {},
    createdBy = "-",
    status = "-",
    rows = [],
    camMember = "-",
    projectStatus = "-",
  } = options;

  // Build table rows
  const itemsHTML = (rows || [])
    .map(
      (r, i) => `
      <tr${r._isChild ? ' class="child-row"' : ""}>
        <td>${r._isChild ? "" : r.sr_no || i + 1}</td>
        <td class="left">${titlePreserveAcronyms(r.name || "")}</td>
        <td>${titlePreserveAcronyms(r.type || "")}</td>
        <td>${titlePreserveAcronyms(r.scope || "")}</td>
        <td>${r.po_number || "-"}</td>
        <td>${prettyStatus(r.po_status)}</td>
        <td>${fmtDate(r.po_date)}</td>
        <td>${fmtDate(r.etd)}</td>
        <td>${fmtDate(r.delivered_date)}</td>
      </tr>`
    )
    .join("");

  // Logo
  const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  // --- HTML TEMPLATE ---
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          font-size: 12px;
          color: #000;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 10%;
          transform: rotate(-45deg);
          font-size: 90px;
          color: rgba(0,0,0,0.05);
          z-index: -1;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .header img {
          max-height: 50px;
          max-width: 150px;
          object-fit: contain;
        }
        h2.title {
          text-align: center;
          margin: 10px 0 16px 0;
          font-size: 20px;
          text-transform: uppercase;
          text-decoration: underline;
        }
        .project-info {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }
        .project-info td {
          padding: 6px 8px;
          border: 1px solid #000;
        }
        .project-info td.label {
          font-weight: bold;
          width: 25%;
          background-color: #f5f5f5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th, td {
          border: 1px solid #000;
          padding: 5px 6px;
          text-align: center;
          vertical-align: top;
        }
        th {
          background-color: #f1f1f1;
        }
        td.left {
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="watermark">Slnko Energy</div>

      <div class="header">
        <img src="${logoSrc}" alt="Slnko Logo" />
      </div>

      <h2 class="title">SCOPE OF WORK</h2>

      <table class="project-info">
        <tr>
          <td class="label">Project Name:</td>
          <td>${titlePreserveAcronyms(project.name || "-")}</td>
          <td class="label">Project Code:</td>
          <td>${project.code || "-"}</td>
        </tr>
        <tr>
          <td class="label">Created Date:</td>
          <td>${fmtDate(scope.createdAt)}</td>
          <td class="label">CAM Person Name:</td>
          <td>${titlePreserveAcronyms(camMember)}</td>
        </tr>
        <tr>
          <td class="label">Last Updated Date:</td>
          <td>${fmtDate(scope.updatedAt)}</td>
          <td class="label">Project Status:</td>
          <td>${prettyStatus(projectStatus) || "-"}</td>
        </tr>
      </table>

      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Item Name</th>
            <th>Type</th>
            <th>Scope</th>
            <th>PO Number</th>
            <th>PO Status</th>
            <th>PO Date</th>
            <th>ETD</th>
            <th>Delivered Date</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // --- Puppeteer PDF Generation ---
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "5mm", right: "5mm" },
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = generateScopeSheet;

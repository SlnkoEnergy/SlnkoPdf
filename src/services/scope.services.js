// services/scope.services.js
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

// dd-MM-yyyy
const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// ---- Column registry (extend as needed) ----
const COLUMN_REGISTRY = {
  type: { label: "Type", get: (r) => titlePreserveAcronyms(r.type || "") },
  scope: { label: "Scope", get: (r) => titlePreserveAcronyms(r.scope || "") },
  quantity: { label: "Qty", get: (r) => r.quantity ?? "" },
  uom: { label: "UoM", get: (r) => r.uom ?? "" },
  remarks: {
    label: "Remarks",
    get: (r) => fmtDate(r.remarks),
  },
  commitment_date: {
    label: "Commitment Date",
    get: (r) => fmtDate(r.commitment_date),
  },
  po_number: { label: "PO Number", get: (r) => r.po_number || "-" },
  po_status: { label: "PO Status", get: (r) => prettyStatus(r.po_status) },
  po_date: { label: "PO Date", get: (r) => fmtDate(r.po_date) },
  etd: { label: "ETD", get: (r) => fmtDate(r.etd) },
  delivered_date: {
    label: "Delivered Date",
    get: (r) => fmtDate(r.delivered_date),
  },
};

const DEFAULT_COLUMN_KEYS = [
  "scope",
  "commitment_date",
  "po_number",
  "po_status",
  "po_date",
  "etd",
  "delivered_date",
];

// Build a normalized list of column defs from options.columns
function resolveColumns(options = {}) {
  const inputCols = Array.isArray(options.columns) ? options.columns : null;

  let keysAndLabels;
  if (inputCols && inputCols.length) {
    // accepts ["po_number"] or [{key:"po_number", label:"PO Number"}]
    keysAndLabels = inputCols.map((c) =>
      typeof c === "string"
        ? { key: c, label: null }
        : { key: c.key, label: c.label ?? null }
    );
  } else {
    keysAndLabels = DEFAULT_COLUMN_KEYS.map((k) => ({ key: k, label: null }));
  }

  const defs = [];
  const seen = new Set();
  for (const { key: rawKey, label } of keysAndLabels) {
    const key = rawKey && String(rawKey).trim();
    if (!key || seen.has(key)) continue;
    const reg = COLUMN_REGISTRY[key];
    if (!reg) continue;
    defs.push({
      key,
      label: label || reg.label,
      get: reg.get,
    });
    seen.add(key);
  }

  // Ensure at least one column
  if (!defs.length) {
    defs.push({
      key: "po_number",
      label: COLUMN_REGISTRY.po_number.label,
      get: COLUMN_REGISTRY.po_number.get,
    });
  }
  return defs;
}

async function generateScopeSheet(scope, options = {}) {
  const {
    project = {},
    createdBy = "-",
    status = "-",
    rows = [],
    camMember = "-",
    projectStatus = "-",
    pdfOptions = {},
    columns, // may be undefined; resolveColumns handles fallback
  } = options;

  const columnDefs = resolveColumns({ columns });

  // Build table rows (supports child rows)
  const itemsHTML = (rows || [])
    .map((r, i) => {
      const dynamicTds = columnDefs
        .map((c) => `<td class="cell">${c.get(r) ?? ""}</td>`)
        .join("");

      return `
        <tr${r._isChild ? ' class="child-row"' : ""}>
          <td class="sno">${r._isChild ? "" : r.sr_no || i + 1}</td>
          <td class="left cell">${titlePreserveAcronyms(r.name || "")}</td>
          ${dynamicTds}
        </tr>`;
    })
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
        * { box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          margin: 24px;
          font-size: 12px;
          color: #000;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
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
          margin-bottom: 16px;
          font-size: 12px;
        }
        .project-info td {
          padding: 6px 8px;
          border: 1px solid #000;
          vertical-align: top;
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
          table-layout: fixed; /* ensures wrapping works correctly */
        }
        th, td {
          border: 1px solid #000;
          padding: 6px 7px;
          text-align: center;
          vertical-align: top;
          background: #fff;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        thead th {
          background-color: #f1f1f1;
          font-weight: 700;
        }
        td.left { text-align: left; }
        .sno { width: 48px; }
        td.left.cell { min-width: 160px; }
        tr.child-row td { background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="watermark">Slnko Energy</div>

      <div class="header">
        <img src="${logoSrc}" alt="Slnko Logo" />
      </div>

      <h2 class="title">Material Status</h2>

      <table class="project-info">
        <tr>
          <td class="label">Project Name:</td>
          <td class="cell left">${titlePreserveAcronyms(
            project.name || "-"
          )}</td>
          <td class="label">Project Code:</td>
          <td class="cell">${project.code || "-"}</td>
        </tr>
        <tr>
          <td class="label">Created Date:</td>
          <td class="cell">${fmtDate(scope.createdAt)}</td>
          <td class="label">CAM Person Name:</td>
          <td class="cell left">${titlePreserveAcronyms(camMember)}</td>
        </tr>
        <tr>
          <td class="label">Last Updated Date:</td>
          <td class="cell">${fmtDate(scope.updatedAt)}</td>
          <td class="label">Project Status:</td>
          <td class="cell">${prettyStatus(projectStatus) || "-"}</td>
        </tr>
      </table>

      <table>
        <colgroup>
          <col style="width:48px" />
          <col style="width:auto" />
          ${columnDefs.map(() => `<col style="width:auto" />`).join("")}
        </colgroup>
        <thead>
          <tr>
            <th>S.No</th>
            <th class="left">Category Name</th>
            ${columnDefs.map((c) => `<th>${c.label}</th>`).join("")}
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
    format: pdfOptions.format || "A4",
    landscape: !!pdfOptions.landscape,
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "5mm", right: "5mm" },
    preferCSSPageSize: true,
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = generateScopeSheet;

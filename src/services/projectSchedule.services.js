// services/projectSchedule.services.js
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

/**
 * Generate "Project Schedule" PDF
 */
async function generateProjectSchedulePdf(
    data,
    project_code = "",
    project_name = "",
    customer = "",
    state = ""
) {
    try {
        const safe = (v) =>
            String(v ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

        const rowsHTML = (Array.isArray(data) ? data : [])
            .map(
                (row) => `
      <tr class="row">
        <td class="num">${safe(row.sno)}</td>
        <td class="left">${safe(row.activity)}</td>
        <td class="num">${safe(row.duration)}</td>
        <td>${safe(row.bstart)}</td>
        <td>${safe(row.bend)}</td>
        <td>${safe(row.astart)}</td>
        <td>${safe(row.aend)}</td>
        <td>${safe(row.status)}</td>   <!-- 👈 plain cell now -->
        <td class="left pred">${safe(row.pred)}</td>
      </tr>`
            )
            .join("");

        const logoData = fs.readFileSync(
            path.resolve(__dirname, "../assets/1.png")
        );
        const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

        const today = new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root{
    --text:#1f2937;
    --muted:#6b7280;
    --border:#d1d5db;
    --bg:#ffffff;
    --stripe:#f9fafb;
    --accent:#2563eb;
    --accent-weak:#eff6ff;
  }

  *{ box-sizing:border-box; }
  html,body{ margin:0; padding:0; }
  body{
    font-family: Arial, Helvetica, sans-serif;
    color:var(--text);
    background:var(--bg);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 28px 24px 16px 24px;
  }

  .watermark{
    position:fixed; top:45%; left:8%;
    transform:rotate(-30deg);
    font-size:100px; letter-spacing:2px;
    color:rgba(0,0,0,0.035);
    z-index:-1; user-select:none;
    white-space:nowrap;
  }

  .header{
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:10px;
  }
  .brand{ display:flex; align-items:center; gap:12px; }
  .brand img{ height:48px; width:auto; object-fit:contain; }
  .brand .company{ font-weight:700; font-size:16px; letter-spacing:.3px; }
  .addr{
    font-size:11px; color:var(--muted); line-height:1.35; text-align:right;
  }
  .addr a{ color:var(--muted); text-decoration:none; }

  .titlebar{
    margin:8px 0 14px 0;
    border-left:4px solid var(--accent);
    padding-left:10px;
  }
  .title{ margin:0; font-size:20px; font-weight:700; }
  .subtitle{ margin:2px 0 0 0; color:var(--muted); font-size:12px; }

  .meta{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:8px 16px;
    border:1px solid var(--border);
    border-radius:8px;
    padding:10px 12px;
    background:var(--accent-weak);
    margin-bottom:14px;
    font-size:12px;
  }
  .meta .item{ display:flex; gap:8px; }
  .meta .label{ color:var(--muted); min-width:110px; }
  .meta .value{ font-weight:600; color:var(--text); }

  table{
    width:100%;
    border-collapse:separate;
    border-spacing:0;
    font-size:12px;
    border:1px solid var(--border);
    border-radius:10px;
    overflow:hidden;
  }

  thead th{
    background:var(--accent);
    color:#fff;
    text-align:center;
    padding:8px 6px;
    border-right:1px solid rgba(255,255,255,0.2);
    font-weight:700;
    letter-spacing:.2px;
  }
  @media screen {
    thead th { position: sticky; top: 0; }
  }

  tbody td{
    padding:7px 6px;
    border-top:1px solid var(--border);
    border-right:1px solid var(--border);
    word-break:break-word;
  }
  tbody td:last-child{ border-right:none; }
  tbody tr:nth-child(odd){ background:var(--stripe); }

  .left{ text-align:left; }
  .num{ text-align:center; width:40px; }

  .pred{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  /* Page-break rules — keep rows intact, let table start on page 1 */
  tr, td, th { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="watermark">SLNKO ENERGY</div>

  <div class="header">
    <div class="brand">
      <img src="${logoSrc}" alt="SLNKO Logo"/>
      <div class="company">SLNKO ENERGY PVT LTD</div>
    </div>
    <div class="addr">
      2nd Floor, B58B, Block B, Sector 60, Noida, UP 201309<br/>
      mail: <a href="mailto:info@slnkoenergy.com">info@slnkoenergy.com</a> &nbsp;|&nbsp;
      web: <a href="https://slnkoprotrac.com" target="_blank">slnkoprotrac.com</a><br/>
      Generated: ${safe(today)}
    </div>
  </div>

  <div class="titlebar">
    <h1 class="title">Project Schedule</h1>
    <p class="subtitle">Detailed baseline & actual timeline with predecessors</p>
  </div>

  <div class="meta">
    <div class="item"><div class="label">Project Code</div><div class="value">${safe(project_code)}</div></div>
    <div class="item"><div class="label">Project Name</div><div class="value">${safe(project_name)}</div></div>
    <div class="item"><div class="label">Customer</div><div class="value">${safe(customer)}</div></div>
    <div class="item"><div class="label">State</div><div class="value">${safe(state)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:48px;">S.No</th>
        <th style="min-width:180px; text-align:left;">Activity</th>
        <th style="width:72px;">Duration</th>
        <th style="width:105px;">Baseline Start</th>
        <th style="width:105px;">Baseline End</th>
        <th style="width:105px;">Actual Start</th>
        <th style="width:105px;">Actual End</th>
        <th style="min-width:110px;">Status</th>
        <th style="min-width:140px; text-align:left;">Predecessor</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
  </table>

</body>
</html>`;

        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: "networkidle0" });

            const pdfBuffer = await page.pdf({
                format: "A4",
                landscape: true,
                printBackground: true,
                preferCSSPageSize: true,
                margin: { top: "10mm", bottom: "12mm", left: "8mm", right: "8mm" },
                displayHeaderFooter: true,
                headerTemplate: `<div></div>`,
                footerTemplate: `
          <div style="font-size:9px;width:100%;padding:6px 16px;color:#6b7280;display:flex;justify-content:space-between;">
            <div>© SLNKO Energy Pvt. Ltd.</div>
            <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
          </div>
        `,
            });

            return pdfBuffer;
        } finally {
            await browser.close();
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
}

module.exports = generateProjectSchedulePdf;

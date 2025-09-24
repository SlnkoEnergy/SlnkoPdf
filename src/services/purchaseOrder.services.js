// services/purchaseOrder.services.js
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

async function generatePurchaseOrderSheet(Purchase, orderNumber, vendorName, date, project_id, message) {
  try {
    // ---------- helpers ----------

    // const fmtINR = (n) =>
    //   new Intl.NumberFormat("en-IN", {
    //     style: "currency",
    //     currency: "INR",
    //     minimumFractionDigits: 2,
    //     maximumFractionDigits: 2,
    //   }).format(Number(n || 0));

    const fmtDateTime = (d) => {
      if (!d) return "-";
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      
      return `${dd}/${mm}/${yyyy} `;
    };

    // ---------- meta ----------
    const orderDateISO = new Date().toISOString();

    // ---------- totals ----------
    let totalAmt = 0;
    let gstAmt = 0;
    let untax = 0;

    (Purchase || []).forEach((item) => {
      const base = Number(item?.amount || 0);
      const rate = Number((item?.quantity * item?.unit_price * item?.taxes))/100;
      // const rate = Number(item?.taxes || 0); // percent
      const untax_amount = Number(item?.quantity * item?.unit_price)
      totalAmt += base;
      gstAmt += rate;
      untax += untax_amount;
    });

    // ---------- rows ----------
    const itemsHTML = (Purchase || [])
      .map((item, i) => {

        return `
          <tr>
            <td>${item?.category || "NA"}</td>
            <td>${item.product}</td>
            <td class="num">${item?.quantity ?? 0}</td>
            <td class="num">Rs. ${(item?.unit_price).toLocaleString("en-IN")}</td>
            <td>${item.taxes}%</td>
            <td class="num">Rs. ${(item?.amount).toLocaleString("en-IN")}</td>
          </tr>
        `;
      })
      .join("");

    const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
    const logoSrc = `data:image/png;base64, ${logoData.toString("base64")}`;

    // ---------- HTML ----------
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  :root{
    --brand:#1F487C;         /* your requested color */
    --ink:#0f172a;           /* slate-900 */
    --muted:#64748b;         /* slate-500 */
    --line:#e2e8f0;          /* slate-200 */
    --bg:#ffffff;
  }
   
.content {
  position: relative;
  z-index: 1;
}

  *{ box-sizing:border-box; }
  html,body{
    margin:0; padding:0; background:var(--bg); color:var(--ink);
    font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji";
    font-variant-numeric: tabular-nums;
  }
  body{ font-family: Arial, sans-serif; padding:24px 28px; }

  /* Title and PO number same color */
  .po-title{ font-size:26px; font-weight:500; margin:0 0 0px 30px; color:var(--brand); }
  .po-number{ color:inherit; }

  .meta{
    display:flex; grid-template-columns:1fr 1fr; gap:10px 36px; justify-content:space-between;
    padding:14px 0 12px 8px; margin-bottom:12px; border-top:1px solid var(--line);
  }
  .meta .label{ color:var(--muted); font-weight:700; font-size:12px; margin-bottom:2px; }
  .meta .value{ font-weight:600; padding-right: 8px;}

  table{ width:100%; border-collapse:collapse; margin-top:14px; border:1px solid var(--line); border: 0 !important;            /* no outer box */
  border-collapse: collapse; 
  border-spacing: 0; }
  thead th{
    background:#f8fafc; color:var(--muted); text-transform:uppercase; letter-spacing:.02em;
    font-size:12px; padding:10px 12px; text-align:left; border-bottom:1px solid var(--line);
  }
  tbody td{ padding:12px; border-bottom:1px solid var(--line); vertical-align:top; }
  tbody tr:nth-child(even) td{ background:#fcfdff; }
  .num{ text-align:left; white-space:nowrap; }
  tbody td:nth-child(3){ color:var(--ink); }
  tbody td:nth-child(3) .rate{ display:block; color:var(--muted); font-size:12px; }

  /* Totals */
  table.summary{
    width:360px; margin-left:auto; margin-top:16px; border:0;
  }
  table.summary td{ padding:10px 0; border-bottom:1px dashed var(--line); }
  table.summary tr:last-child td{ border-bottom:0; font-weight:800; font-size:16px; }
  table.summary td.label{ color:var(--muted); }
  table.summary td.num{ text-align:right; white-space:nowrap; }

  /* Totals Card */
.totals-card{
  width: 340px;              /* tweak if you want */
  margin-left: auto;         /* stick to the right */
  margin-top: 10px;
  padding: 12px 16px;
  background: #f1f5f9;       /* soft blue/grey */
  border: 1px solid var(--line);
  border-radius: 12px;
}
.totals-card .tc-row{
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
}
.totals-card .tc-label{
  color: var(--muted);
  font-weight: 600;
}
.totals-card .tc-num{
  font-weight: 600;
  white-space: nowrap;
}
.totals-card .tc-divider{
  border: 0;
  border-top: 1px dashed var(--line);
  margin: 6px 0;
}
.totals-card .tc-row.total .tc-label{
  color: var(--ink);
  font-weight: 800;
}
.totals-card .tc-row.total .tc-num{
  font-weight: 800;
  font-size: 16px;
}

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;  /* pushes the right block to the edge */
  gap:16px;
  margin:0 8px 8px 8px;
}

.header img{
  display:block;
  width:110px;        /* tweak size as needed */
  height:auto;
  object-fit:contain;
  flex:0 0 auto;
}

/* Right side (Project + PO) */
.header .right{
  display:flex;
  flex-direction:column;
  align-items:flex-end;   /* right-align text */
  text-align:right;
  gap:4px;
  flex:0 0 auto;
}

.project-id{
  margin:0;
  font-size:14px;
  font-weight:400;
  color:#475569;          /* slate-ish */
}

.po-number{
  margin:0;
  font-size:18px;
  font-weight:500;
  color:#1F487C;          /* your brand color */
}


  @page{ margin:12mm 2mm 12mm 2mm; }
  @media print{
    body{ padding:0; }
    .meta{ margin-bottom:8px; }
    thead th{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>
 
<div class="header">
  <img src="${logoSrc}" alt="Slnko Logo" />

  <div class="right">
  <div class="po-number"> ${orderNumber ? `PO No: ${orderNumber}` : "REQUEST FOR QUOTATION (RFQ)"}</div>
    <div class="project-id">Project ID: ${project_id || "-"}</div>
  </div>
</div>

  
 
  <div class="meta">
    <div>
      <div class="label">Vendor Name</div>
      <div class="value">${vendorName}</div>
    </div>
    <div>
      <div class="label">Order Date</div>
      <div class="value">${fmtDateTime(date)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:20%">Category</th>
        <th style="width:20%">Product</th>
        <th style="width:12%">Qty</th>
        <th style="width:12%">Unit Price</th>
        <th style="width:12%">Taxes</th>
        <th style="width:12%">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div class="totals-card">
  <div class="tc-row">
    <span class="tc-label">Untaxed Amount:</span>
    <span class="tc-num">Rs. ${untax.toLocaleString("en-IN")}</span>
  </div>

  <div class="tc-row">
    <span class="tc-label">Tax:</span>
    <span class="tc-num">Rs. ${(gstAmt.toLocaleString("en-IN"))}</span>
  </div>

  <hr class="tc-divider"/>

  <div class="tc-row total">
    <span class="tc-label">Total:</span>
    <span class="tc-num">Rs. ${totalAmt.toLocaleString("en-IN")}</span>
  </div>
</div>
  </div>

  <div style="padding: 20px 0px 20px 30px; text-align: left;">
  ${message ? message : ""}
</div>


</body>
</html>
`;

    // ---------- Puppeteer ----------
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });


    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "6mm", bottom: "20mm", left: "2mm", right: "2mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      // Footer: line 1 => Page X of Y, line 2 => system-generated notice
      footerTemplate: `
            <div style="width:100%; text-align:center; margin-top:10px;">
  <hr style="border: 0; border-top: 1px solid #475569; margin-bottom:6px;"/>

  <div style="font-size:10px; color:#6b7280; padding:4px 0;">
    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>
  <div style="font-size:10px; color:#6b7280; padding:2px 0 6px;">
    This is a system generated document and does not require signature.
  </div>
</div>
      `,
    });

    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

module.exports = generatePurchaseOrderSheet;

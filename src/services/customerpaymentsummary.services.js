const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

function inr(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-IN");
}
const sumBy = (arr, key) => (arr || []).reduce((a, x) => a + Number(x?.[key] || 0), 0);

const fmtLongDate = (d) =>
  new Date(d || Date.now()).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

async function generateCustomerPaymentSheet(
  projectOrCredits,
  DebitHistorysOr,
  purchaseHistorysOr,
  saleHistorysOr,
  AdjustmentHistorysOr,
  balanceSummaryOr,
  reportDateOr
) {
  let projectDetails = {};
  let creditHistorys, DebitHistorys, purchaseHistorys, saleHistorys, AdjustmentHistorys, balanceSummary, reportDate;

  if (Array.isArray(projectOrCredits)) {
    creditHistorys = projectOrCredits;
    DebitHistorys = DebitHistorysOr || [];
    purchaseHistorys = purchaseHistorysOr || [];
    saleHistorys = saleHistorysOr || [];
    AdjustmentHistorys = AdjustmentHistorysOr || [];
    balanceSummary = balanceSummaryOr || {};
    reportDate = reportDateOr || new Date();
  } else {
    projectDetails = projectOrCredits || {};
    creditHistorys = DebitHistorysOr || [];
    DebitHistorys = purchaseHistorysOr || [];
    purchaseHistorys = saleHistorysOr || [];
    saleHistorys = AdjustmentHistorysOr || [];
    AdjustmentHistorys = balanceSummaryOr || [];
    balanceSummary = reportDateOr || {};
    reportDate = arguments[7] || new Date();
  }

  try {
    // ---- totals ----
    const creditTotal = sumBy(creditHistorys, "amount");
    const debitTotal = sumBy(DebitHistorys, "amount");
    const pur_po = sumBy(purchaseHistorys, "po_value");
    const pur_adv = sumBy(purchaseHistorys, "Advance_paid");
    const pur_rem = sumBy(purchaseHistorys, "remain_amount");
    const pur_bill = sumBy(purchaseHistorys, "total_billed_value");
    const sale_val_total = sumBy(saleHistorys, "sale_value");
    const adj_credit_total = sumBy(AdjustmentHistorys, "credit_adjust");
    const adj_debit_total = sumBy(AdjustmentHistorys, "debit_adjust");

    const PD = {
      code: projectDetails?.code ?? "-",
      name: projectDetails?.name ?? "-",
      customer_name: projectDetails?.customer_name ?? "-",
      p_group: projectDetails?.p_group ?? "-",
      site_address: projectDetails?.site_address ?? "-",
      project_kwp: projectDetails?.project_kwp ?? "-",
    };

    const creditRows = (creditHistorys || [])
      .map(
        (r, i) => `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.CreditDate || ""}</td>
        <td class="left">${r.mode || ""}</td>
        <td class="num nowrap">₹ ${inr(r.amount)}</td>
      </tr>`
      )
      .join("");

    const debitRows = (DebitHistorys || [])
      .map(
        (r, i) => `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.date || ""}</td>
        <td class="left nowrap">${r.po_number || ""}</td>
        <td class="left">${r.paid_for || ""}</td>
        <td class="left">${r.paid_to || ""}</td>
        <td class="left nowrap">${r.utr || ""}</td>
        <td class="num nowrap">₹ ${inr(r.amount)}</td>
        
      </tr>`
      )
      .join("");

    const purchaseRows = (purchaseHistorys || [])
      .map(
        (r, i) => `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.po_number || ""}</td>
        <td class="left">${r.vendor || ""}</td>
        <td class="left">${r.item_name || ""}</td>
        <td class="num nowrap">₹ ${inr(r.po_value)}</td>
        <td class="num nowrap">₹ ${inr(r.Advance_paid)}</td>
        <td class="num nowrap">₹ ${inr(r.remain_amount)}</td>
        <td class="num nowrap">₹ ${inr(r.total_billed_value)}</td>
      </tr>`
      )
      .join("");

    const salesRows = (saleHistorys || [])
      .map(
        (r, i) => `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.po_number || ""}</td>
        <td class="left nowrap">${r.converted_at || ""}</td>
        <td class="left">${r.vendor || ""}</td>
        <td class="left">${r.item || ""}</td>
        <td class="num nowrap">₹ ${inr(r.sale_value)}</td>
      </tr>`
      )
      .join("");

    const adjustRows = (AdjustmentHistorys || [])
      .map(
        (r, i) => `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.date || ""}</td>
        <td class="left">${r.reason || ""}</td>
        <td class="left nowrap">${r.po_number || ""}</td>
        <td class="left">${r.paid_for || ""}</td>
        <td class="left">${r.description || ""}</td>
        <td class="num nowrap">₹ ${inr(r.credit_adjust)}</td>
        <td class="num nowrap">₹ ${inr(r.debit_adjust)}</td>
      </tr>`
      )
      .join("");

 
    const bs = Array.isArray(balanceSummary) ? balanceSummary[0] || {} : balanceSummary || {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = bs?.[k];
        if (v !== undefined && v !== null) return v;
      }
      return 0;
    };

const billingType = bs.billing_type || projectDetails.billing_type || "-";

const bsLines = [
  { no: "1",  label: "Total Received",                                  val: pick("total_received", "totalCredited") },
  { no: "2",  label: "Total Return",                                    val: pick("total_return", "totalReturn") },
  { no: "3",  label: "Net Balance ([1]-[2])",                           val: pick("netBalance", "net_balance"), cls: "muted" },
  { no: "4",  label: "Total Advance Paid to Vendors",                   val: pick("total_advance_paid", "totalAdvancePaidToVendors", "totalAdvancePaid") },
  { no: "4A", label: "Total Adjustment (Debit-Credit)",                 val: pick("total_adjustment", "totalAdjustment") },
  { no: "5",  label: "Balance With Slnko ([3]-[4]-[4A])",               val: pick("balance_with_slnko", "balanceWithSlnko"), cls: "accent" },
  { no: "6",  label: "Total PO Basic Value",                            val: pick("total_po_basic", "totalPoBasic") },
  { no: "7",  label: "GST Value as per PO",                             val: pick("gst_as_po_basic", "gstAsPoBasic") },
  { no: "8",  label: "Total PO with GST",                               val: pick("total_po_with_gst", "totalPoWithGst") },
  { no: "8A", label: "Total Sales with GST",                            val: pick("total_sales", "totalSale") },
  { no: "9",  label: `GST (${billingType})`,                            val: pick("gst_with_type_percentage", "gstWithTypePercentage") },
  { no: "10", label: "Total Billed Value",                              val: pick("total_billed_value", "totalBilledValue") },
  { no: "11", label: "Net Advance Paid ([4]-[10])",                     val: pick("net_advanced_paid", "netAdvancePaid") },
  { no: "12", label: "Balance Payable to Vendors ([8]-[10]-[11])",      val: pick("balance_payable_to_vendors", "balancePayableToVendors"), cls: "accent" },
  { no: "13", label: "TCS as Applicable",                               val: pick("tcs_as_applicable", "tcsAsApplicable") },
  { no: "14", label: "Extra GST Recoverable from Client ([8]-[6])",     val: pick("extraGST", "extra_gst") },
  { no: "15", label: "Balance Required ([5]-[12]-[13])",                val: pick("balance_required", "balanceRequired"), cls: "strong" },
];


    const bsRows = bsLines.map(line => `
      <tr class="${line.cls ? line.cls : ""}">
        <td class="sno nowrap">${line.no}</td>
        <td class="left">${line.label}</td>
        <td class="val num nowrap">₹ ${inr(line.val)}</td>  
      </tr>
    `).join("");

    // ---- assets ----
    const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
    const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

    // ---- HTML/CSS ----
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 10mm 8mm 18mm 8mm; } /* a touch more bottom for footer */
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; color: #121417; }

    /* header */
    .header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:6px 4px 8px; border-bottom:1px solid #DDE3EA; }
    .header img { max-height: 42px; object-fit: contain; }
    .brand-title { margin:0; font-size:17px; font-weight:800; letter-spacing:.5px; }
    .brand-sub { margin:0; font-size:12px; color:#4B5563; line-height:1.3; }
    .brand-sub a { color:#2563EB; text-decoration:none; }

    /* title + date */
    .date-style { margin: 15px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
    .titlebar { margin-top: 10px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
    .titlebar h1 { grid-column: 2 / 3; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: .4px; }
    .report-date { grid-column: 3 / 4; justify-self: end; font-size: 12px; color: #4B5563; }

    /* project details */
    .pd { border:1px solid #E5E7EB; border-radius:8px; padding:10px; margin-top:10px; page-break-inside: avoid; }
    .pd h3 { margin:0 0 8px 0; font-size:13px; font-weight:800; color:#1F2937; }
    .pd-grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px 12px; }
    .field { border:1px solid #E5E7EB; border-radius:6px; background:#F9FAFB; padding:6px 8px; }
    .label { font-size:10px; color:#6B7280; margin:0 0 2px 0; }
    .value { font-size:12px; font-weight:600; margin:0; color:#111827; }

    /* sections */
    .section { margin: 16px 0 8px; page-break-inside: avoid; break-inside: avoid; }
    .section-title { margin:0; font-size:15px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; color:#111827; break-after: avoid; }

    /* tables */
    table { width:100%; border-collapse:collapse; border-spacing:0; font-size:11px; margin:6px 0 10px; }
    thead th { background:#F3F4F6; color:#111827; border:1px solid #D1D5DB; padding:6px; text-align:center; font-weight:700; }
    td, th { border:1px solid #E5E7EB; padding:6px; text-align:center; vertical-align:top; background:#fff; }
    td.left, th.left { text-align:left; }
    td.right, th.right { text-align:right; }
    tfoot td { font-weight:800; background:#FAFAFA; }
    tr { break-inside: avoid; page-break-inside: avoid; }

    /* print stability */
    .table-fixed { table-layout: fixed; }
    .nowrap { white-space: nowrap; word-break: keep-all; hyphens: none; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }

    /* Balance summary */
    .bs-wrap { width: 68%; margin-top: 30px; }
    .bs .sno { width:42px; text-align:center; }
    .bs .val { text-align:right; white-space:nowrap; }
    .bs tr.muted td { background:#F5F6F8; }
    .bs tr.accent td { background:#EAF7EE; }
    .bs tr.strong td { background:#EAF2FF; font-weight:800; }

    @media print {
      thead { display: table-header-group !important; }
      /* We want totals once at the end, not on every page */
      tfoot { display: table-row-group !important; }

      table { page-break-inside: auto; }
      tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
      .section, .pd { page-break-inside: avoid !important; break-inside: avoid !important; }
    }
  </style>
</head>
<body>

  <!-- Date + header -->
  <div class="date-style"><div></div><div class="report-date">${fmtLongDate(reportDate)}</div></div>
  <div class="header">
    <img src="${logoSrc}" alt="SLNKO Logo"/>
    <div style="display:flex; flex-direction:column;">
      <p class="brand-title">SLNKO ENERGY PVT LTD</p>
      <p class="brand-sub">2nd Floor, B58B, Block B, Sector 60, Noida, Uttar Pradesh 201309</p>
      <p class="brand-sub">mail: <a href="mailto:info@slnkoenergy.com">info@slnkoenergy.com</a> &nbsp;|&nbsp; web: <a href="https://slnkoprotrac.com" target="_blank">slnkoprotrac.com</a></p>
    </div>
  </div>

  <!-- Title -->
  <div class="titlebar"><div></div><h1>Customer Payment Summary</h1></div>

  <!-- Project details -->
  <div class="pd">
    <h3>Project Details</h3>
    <div class="pd-grid">
      <div class="field"><p class="label">Project ID</p><p class="value">${PD.code}</p></div>
      <div class="field"><p class="label">Project Name</p><p class="value">${PD.name}</p></div>
      <div class="field"><p class="label">Client Name</p><p class="value">${PD.customer_name}</p></div>
      <div class="field"><p class="label">Group Name</p><p class="value">${PD.p_group}</p></div>
      <div class="field"><p class="label">Plant Location</p><p class="value">${PD.site_address}</p></div>
      <div class="field"><p class="label">Plant Capacity (MW)</p><p class="value">${PD.project_kwp}</p></div>
    </div>
  </div>

  <!-- CREDIT -->
  <div class="section"><h2 class="section-title">Credit History</h2></div>
  <table class="table-fixed">
    <colgroup>
      <col style="width:44px">
      <col style="width:100px">
      <col style="width:180px">
      <col style="width:120px">
    </colgroup>
    <thead>
      <tr><th>S.No</th><th>Credit Date</th><th class="left">Mode</th><th>Amount (₹)</th></tr>
    </thead>
    <tbody>${creditRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="3" class="right">Total Credited</td><td class="num nowrap">₹ ${inr(creditTotal)}</td></tr>
    </tfoot>
  </table>

  <!-- DEBIT -->
  <div class="section"><h2 class="section-title">Debit History</h2></div>
  <table class="table-fixed">
    <colgroup>
      <col style="width:44px">
      <col style="width:100px">
      <col style="width:140px">
      <col style="width:150px">
      <col style="width:170px">
      <col style="width:110px">
      <col style="width:150px">
    </colgroup>
    <thead>
      <tr>
        <th>S.No</th><th>Date</th><th>PO Number</th><th class="left">Paid For</th>
        <th class="left">Paid To</th><th>UTR</th><th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${debitRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="6" class="right">Total Debited</td><td class="num nowrap">₹ ${inr(debitTotal)}</td></tr>
    </tfoot>
  </table>

  <!-- PURCHASE -->
  <div class="section"><h2 class="section-title">Purchase History</h2></div>
  <table class="table-fixed">
    <colgroup>
      <col style="width:44px">
      <col style="width:120px">
      <col style="width:170px">
      <col style="width:200px">
      <col style="width:110px">
      <col style="width:120px">
      <col style="width:120px">
      <col style="width:130px">
    </colgroup>
    <thead>
      <tr>
        <th>S.No</th><th>PO Number</th><th class="left">Vendor</th><th class="left">Item Name</th>
        <th>PO Value (₹)</th><th>Advance Paid (₹)</th><th>Remaining (₹)</th><th>Total Billed (₹)</th>
      </tr>
    </thead>
    <tbody>${purchaseRows || ""}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="right">Totals</td>
        <td class="num nowrap">₹ ${inr(pur_po)}</td>
        <td class="num nowrap">₹ ${inr(pur_adv)}</td>
        <td class="num nowrap">₹ ${inr(pur_rem)}</td>
        <td class="num nowrap">₹ ${inr(pur_bill)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- SALES -->
  <div class="section"><h2 class="section-title">Sales History</h2></div>
  <table class="table-fixed">
    <colgroup>
      <col style="width:44px">
      <col style="width:120px">
      <col style="width:100px">
      <col style="width:190px">
      <col style="width:220px">
      <col style="width:120px">
    </colgroup>
    <thead>
      <tr><th>S.No</th><th>PO Number</th><th>Conversion Date</th><th class="left">Vendor</th><th class="left">Item Name</th><th>Sales Value (₹)</th></tr>
    </thead>
    <tbody>${salesRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="4" class="right">Total Sales</td><td class="num nowrap">₹ ${inr(sale_val_total)}</td></tr>
    </tfoot>
  </table>

  <!-- ADJUSTMENT -->
  <div class="section"><h2 class="section-title">Adjustment History</h2></div>
  <table class="table-fixed">
    <colgroup>
      <col style="width:44px">
      <col style="width:100px">
      <col style="width:140px">
      <col style="width:120px">
      <col style="width:140px">
      <col style="width:auto">
      <col style="width:120px">
      <col style="width:120px">
    </colgroup>
    <thead>
      <tr>
        <th>S.No</th><th>Date</th><th class="left">Reason</th><th>PO Number</th><th class="left">Paid For</th>
        <th class="left">Description</th><th>Credit Adjust (₹)</th><th>Debit Adjust (₹)</th>
      </tr>
    </thead>
    <tbody>${adjustRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="6" class="right">Totals</td><td class="num nowrap">₹ ${inr(adj_credit_total)}</td><td class="num nowrap">₹ ${inr(adj_debit_total)}</td></tr>
    </tfoot>
  </table>

  <!-- BALANCE SUMMARY -->
  <div class="section bs-wrap">
    <h2 class="section-title">Balance Summary</h2>
    <div class="bs">
      <table class="table-fixed">
        <colgroup>
          <col style="width:42px"><col style="width:auto"><col style="width:140px">
        </colgroup>
        <thead><tr><th style="width:42px">S.No.</th><th class="left">Description</th><th>Value</th></tr></thead>
        <tbody>${bsRows || ""}</tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;

 
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

   
    await page.emulateMediaType("print");
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:1px;"></div>`,
      footerTemplate: `
        <div style="font-size:10px; width:100%; text-align:center; color: gray; padding:5px 0;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span> | © SLNKO Energy Pvt. Ltd.
        </div>
      `,
      margin: { top: "8mm", bottom: "18mm", left: "6mm", right: "6mm" },
      preferCSSPageSize: true,
    });

    await browser.close();
    return pdfBuffer;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

module.exports = generateCustomerPaymentSheet;

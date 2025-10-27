const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

/* ---------------- helpers ---------------- */
function inr(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-IN");
}
const sumBy = (arr, key) =>
  (arr || []).reduce((a, x) => a + Number(x?.[key] || 0), 0);

const fmtLongDate = (d) =>
  new Date(d || Date.now()).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const FONT_CANDIDATES = [
  path.resolve(__dirname, "../assets/fonts/DejaVuSans.woff2"),
  path.resolve(__dirname, "../assets/fonts/DejaVuSans.ttf"),
  path.resolve(__dirname, "../assets/fonts/NotoSansSymbols2-Regular.ttf"),
];

function loadEmbeddedFontCSS() {
  for (const p of FONT_CANDIDATES) {
    try {
      if (!fs.existsSync(p)) continue;
      const buf = fs.readFileSync(p);
      const ext = path.extname(p).toLowerCase();
      const isWoff2 = ext === ".woff2";
      const mime = isWoff2 ? "font/woff2" : "font/ttf";
      const format = isWoff2 ? "woff2" : "truetype";
      const b64 = buf.toString("base64");
      return `
@font-face{
  font-family:'PdfSans';
  src:url('data:${mime};base64,${b64}') format('${format}');
  font-weight:normal;
  font-style:normal;
  font-display:swap;
}
`;
    } catch (_) {}
  }
  return "";
}

/* ---- value helpers ---- */
const safeNum = (v) => Number(v || 0);

function derivePO(r) {
  const basic = safeNum(r.po_basic ?? r.poBasic ?? r.basic ?? r.po_value_basic);
  const total = safeNum(r.po_total ?? r.poTotal ?? r.total ?? r.po_value);
  let gst = safeNum(r.po_gst ?? r.poGst ?? r.gst);
  if (!gst && total && basic) gst = total - basic;
  const resolvedTotal = total || basic + gst;
  return { basic, gst, total: resolvedTotal };
}
function deriveBilled(r) {
  const basic = safeNum(
    r.billed_basic ?? r.billedBasic ?? r.total_billed_basic
  );
  const total = safeNum(
    r.billed_total ?? r.billedTotal ?? r.total_billed_value
  );
  let gst = safeNum(r.billed_gst ?? r.billedGst ?? r.total_billed_gst);
  if (!gst && total && basic) gst = total - basic;
  const resolvedTotal = total || basic + gst;
  return { basic, gst, total: resolvedTotal };
}
/* Sales row: we keep Bill Basic separate, and group Value/GST/Total under “Sales” */
function deriveSale(r) {
  const billBasic = safeNum(r.bill_basic ?? r.billBasic ?? r.basic ?? 0);
  const value = safeNum(r.value ?? r.sales_basic ?? 0);
  let gst = safeNum(r.gst_on_sales ?? 0);
  let total = safeNum(r.total_sales_value ?? r.total ?? 0);
  if (!total) total = value + gst;
  if (!gst && total && value) gst = total - value;
  return { billBasic, value, gst, total };
}

/* --------------------- main PDF generator -------------------- */
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
  let creditHistorys,
    DebitHistorys,
    purchaseHistorys,
    saleHistorys,
    AdjustmentHistorys,
    balanceSummary,
    reportDate;

  // support both param shapes (as in your original)
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
    /* ---- totals (credits/debits/adjust) ---- */
    const creditTotal = sumBy(creditHistorys, "amount");
    const debitTotal = sumBy(DebitHistorys, "amount");
    const adj_credit_total = sumBy(AdjustmentHistorys, "credit_adjust");
    const adj_debit_total = sumBy(AdjustmentHistorys, "debit_adjust");

    // PO table column totals
    let po_basic_sum = 0,
      po_gst_sum = 0,
      po_total_sum = 0,
      adv_paid_sum = 0,
      adv_remaining_sum = 0,
      billed_basic_sum = 0,
      billed_gst_sum = 0,
      billed_total_sum = 0;

    // Sales totals (Bill Basic separate + grouped “Sales” totals)
    let sales_bill_basic_sum = 0,
      sales_value_sum = 0,
      sales_gst_sum = 0,
      sales_total_sum = 0;

    const PD = {
      code: projectDetails?.code ?? "-",
      name: projectDetails?.name ?? "-",
      customer_name: projectDetails?.customer_name ?? "-",
      p_group: projectDetails?.p_group ?? "-",
      site_address: projectDetails?.site_address ?? "-",
      project_kwp: projectDetails?.project_kwp ?? "-",
    };

    /* ---- section rows ---- */
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
        <td class="left">${r.po_number || ""}</td>
        <td class="left">${r.paid_for || ""}</td>
        <td class="left">${r.paid_to || ""}</td>
        <td class="left nowrap">${r.utr || ""}</td>
        <td class="num nowrap">₹ ${inr(r.amount)}</td>
      </tr>`
      )
      .join("");

    const purchaseRows = (purchaseHistorys || [])
      .map((r, i) => {
        const po = derivePO(r);
        const bill = deriveBilled(r);
        const advPaid = safeNum(r.Advance_paid ?? r.advance_paid);
        const advRemaining = safeNum(r.remain_amount ?? r.advance_remaining);

        // accumulate totals
        po_basic_sum += po.basic;
        po_gst_sum += po.gst;
        po_total_sum += po.total;
        adv_paid_sum += advPaid;
        adv_remaining_sum += advRemaining;
        billed_basic_sum += bill.basic;
        billed_gst_sum += bill.gst;
        billed_total_sum += bill.total;

        return `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.po_number || ""}</td>
        <td class="left wrap">${r.vendor || ""}</td>
        <td class="left">${r.item_name || r.item || "N/A"}</td>

        <td class="num nowrap">₹ ${inr(po.basic)}</td>
        <td class="num nowrap">₹ ${inr(po.gst)}</td>
        <td class="num nowrap">₹ ${inr(po.total)}</td>

        <td class="num nowrap">₹ ${inr(advPaid)}</td>
        <td class="num nowrap">₹ ${inr(advRemaining)}</td>

        <td class="num nowrap">₹ ${inr(bill.basic)}</td>
        <td class="num nowrap">₹ ${inr(bill.gst)}</td>
        <td class="num nowrap">₹ ${inr(bill.total)}</td>
      </tr>`;
      })
      .join("");

    const salesRows = (saleHistorys || [])
      .map((r, i) => {
        const s = deriveSale(r);

        sales_bill_basic_sum += s.billBasic;
        sales_value_sum += s.value;
        sales_gst_sum += s.gst;
        sales_total_sum += s.total;

        return `
      <tr>
        <td class="nowrap">${i + 1}</td>
        <td class="left nowrap">${r.po_number || ""}</td>
        <td class="left nowrap">${r.converted_at || ""}</td>
        <td class="left">${r.vendor || ""}</td>
        <td class="left">${r.item || ""}</td>

        <!-- Bill Basic is OUTSIDE the “Sales” grouped box -->
        <td class="num nowrap">₹ ${inr(s.billBasic)}</td>

        <!-- Grouped Sales columns (Value, GST, Total) -->
        <td class="num nowrap sales-col">₹ ${inr(s.value)}</td>
        <td class="num nowrap sales-col">₹ ${inr(s.gst)}</td>
        <td class="num nowrap sales-col highlight">₹ ${inr(s.total)}</td>
      </tr>`;
      })
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

    /* ---- balance summary computed values ---- */

    const bs = balanceSummary || {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = bs?.[k];
        if (v !== undefined && v !== null) return Number(v) || 0;
      }
      return 0;
    };

    // 4 → Total Advances Paid to Vendors (from PO table)
    const total_advances_paid_vendors = adv_paid_sum;

    // 5 → Invoice issued to customer (Sales total)
    const invoice_issued_to_customer = sales_total_sum;

    // 6 → Bills received, yet to be invoiced to customer (Billed total)
    const bills_received_yet_to_invoice = billed_total_sum;

    // 7 → Advances left after bills received [4 - 5 - 6]
    const advances_left_after_billed =
      bills_received_yet_to_invoice < total_advances_paid_vendors
        ? total_advances_paid_vendors -
          invoice_issued_to_customer -
          bills_received_yet_to_invoice
        : 0;
    // 8 → Adjustment (Debit - Credit)
    const adjustment_debit_minus_credit = adj_debit_total - adj_credit_total;

    // 3 → Net Balance from upstream balanceSummary (kept as-is)
    const net_balance_val = pick("netBalance", "net_balance");

    // 9 → Balance With Slnko [3 - 5 - 6 - 7 - 8]
    const balance_with_slnko_calc =
      net_balance_val -
      invoice_issued_to_customer -
      bills_received_yet_to_invoice -
      advances_left_after_billed -
      adjustment_debit_minus_credit;

    /* ---- rows 1–4 (first section) ---- */
    const section1 = [
      {
        no: 1,
        label: "Total Received",
        val: pick("total_received"),
        cls: "highlight1",
      },
      {
        no: 2,
        label: "Total Return",
        val: pick("total_return"),
        cls: "highlight1",
      },
      {
        no: 3,
        label: "Net Balance [(1)-(2)]",
        val: net_balance_val,
        cls: "highlight2 strong",
      },
      {
        no: 4,
        label: "Total Advances Paid to Vendors",
        val: total_advances_paid_vendors, // ← computed from PO table
      },
    ];

    /* ---- billing rows 5–9 (fully computed) ---- */
    const billingRows = [
      {
        no: 5,
        label: "Invoice issued to customer",
        val: invoice_issued_to_customer, // ← Sales total
      },
      {
        no: 6,
        label: "Bills received, yet to be invoiced to customer",
        val: bills_received_yet_to_invoice, // ← Billed total
      },
      {
        no: 7,
        label: "Advances left after bills received [4-5-6]",
        val: advances_left_after_billed, // ← 4 - 5 - 6
      },
      {
        no: 8,
        label: "Adjustment (Debit-Credit)",
        val: adjustment_debit_minus_credit, // ← Debit - Credit
      },
      {
        no: 9,
        label: "Balance With Slnko [3 - 5 - 6 - 7 - 8]",
        val: balance_with_slnko_calc, // ← computed from 3,5,6,7,8
        cls: "highlight2 strong",
      },
    ];

    const section1Rows = section1
      .map(
        (x) => `
      <tr class="${x.cls || ""}">
        <td class="sno">${x.no}</td>
        <td class="left">${x.label}</td>
        <td class="num nowrap">₹ ${inr(x.val)}</td>
      </tr>`
      )
      .join("");

    const billingRowsHtml = billingRows
      .map(
        (x) => `
      <tr class="${x.cls || ""}">
        <td class="sno">${x.no}</td>
        <td class="left">${x.label}</td>
        <td class="num nowrap">₹ ${inr(x.val)}</td>
      </tr>`
      )
      .join("");

    /* ---- assets ---- */
    const logoData = fs.readFileSync(
      path.resolve(__dirname, "../assets/1.png")
    );
    const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
    const fontFaceCSS = loadEmbeddedFontCSS();

    const PAGE_FORMAT = "A4";
    const ORIENTATION = "landscape";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${PAGE_FORMAT} ${ORIENTATION}; margin: 10mm 8mm 18mm 8mm; }
    ${fontFaceCSS}
    * { box-sizing: border-box; }
    body { font-family: 'PdfSans', Arial, sans-serif; margin: 0; color: #121417; }

    .header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:6px 4px 8px; border-bottom:1px solid #DDE3EA; }
    .header img { max-height: 60px; object-fit: cover; }
    .brand-title { margin:0; font-size:17px; font-weight:800; letter-spacing:.5px; }
    .brand-sub { margin:0; font-size:12px; color:#4B5563; line-height:1.3; }
    .brand-sub a { color:#2563EB; text-decoration:none; }

    .date-style { margin: 15px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
    .titlebar { margin-top: 10px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
    .titlebar h1 { grid-column: 2 / 3; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: .4px; }
    .report-date { grid-column: 3 / 4; justify-self: end; font-size: 12px; color: #4B5563; }

    .pd { border:1px solid #E5E7EB; border-radius:8px; padding:10px; margin-top:10px; page-break-inside: avoid; }
    .pd h3 { margin:0 0 8px 0; font-size:13px; font-weight:800; color:#1F2937; }
    .pd-grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px 12px; }
    .field { border:1px solid #E5E7EB; border-radius:6px; background:#F9FAFB; padding:6px 8px; }
    .label { font-size:10px; color:#6B7280; margin:0 0 2px 0; }
    .value { font-size:12px; font-weight:600; margin:0; color:#111827; }

    table { width:100%; border-collapse:collapse; border-spacing:0; font-size:11px; margin:6px 0 10px; table-layout: fixed; }
    thead th { background:#F3F4F6; color:#111827; border:1px solid #D1D5DB; padding:6px; text-align:center; font-weight:700; }
    td, th { border:1px solid #E5E7EB; padding:6px; text-align:center; vertical-align:top; background:#fff; }
    td.left, th.left { text-align:left; }
    .nowrap { white-space: nowrap; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { font-weight:800; background:#FAFAFA; }
    tr { break-inside: avoid; page-break-inside: avoid; }

    /* long vendor names should wrap nicely without overflowing */
    .wrap { white-space: normal; word-break: break-word; overflow-wrap: anywhere; }

    /* grouped header looks */
    .po-table thead th[colspan] { text-transform:none; font-weight:800; background:#EEF2F7; }
    .right.strong, .num.strong { font-weight:800; }

    /* Sales group shading */
    .sales-group th.group-head { background:#EEF2F7; }
    .sales-col { background:#F7FAFF; }                /* inside the Sales box */
    .sales-col.highlight { background:#E7F1FF; font-weight:700; }

    .bs-wrap { width: 68%; margin-top: 30px; }
    .bs .sno { width:42px; text-align:center; }
    .bs .val { text-align:right; white-space:nowrap; }
    .bs tr.muted td { background:#F5F6F8; }
    .bs tr.accent td { background:#EAF7EE; }
    .bs tr.strong td { background:#EAF2FF; font-weight:800; }
    /* --- force section onto a new PDF page --- */
.pagebreak { break-before: page; page-break-before: always; }

/* keep the whole card together on one page */
.bs-card { border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-top:10px;
  page-break-inside: avoid; break-inside: avoid; }
.bs-card table { border:none; page-break-inside: avoid; break-inside: avoid; }
.bs-card tr, .bs-card td, .bs-card th { page-break-inside: avoid; break-inside: avoid; }

/* Balance Summary coloring to match your screenshot */
.sno { width:42px; text-align:center; }
.highlight1 td { background:#FFF4BF; }   /* soft yellow rows (1,2) */
.highlight2 td { background:#FFE08A; }   /* stronger yellow rows (3, 9) */
.strong td { font-weight:800; }
.billing-title td { background:#F3F4F6; text-align:center; font-weight:700; border-top:2px solid #d1d5db; }


    @media print {
      thead { display: table-header-group !important; }
      tfoot { display: table-row-group !important; }
      table { page-break-inside: auto; }
      tr, td, th { page-break-inside: avoid !important; break-inside: avoid !important; }
      .section, .pd { page-break-inside: avoid !important; break-inside: avoid !important; }
    }
  </style>
</head>
<body>

  <!-- Date + header -->
  <div class="date-style"><div></div><div class="report-date">${fmtLongDate(
    reportDate
  )}</div></div>
  <div class="header">
    <img src="${logoSrc}" alt="SLNKO Logo"/>
    <div style="display:flex; flex-direction:column;">
      <p class="brand-title">SLNKO ENERGY PVT LTD</p>
      <p class="brand-sub">2nd Floor, B58B, Block B, Sector 60, Noida, Uttar Pradesh 201309</p>
      <p class="brand-sub">mail: <a href="mailto:info@slnkoenergy.com">info@slnkoenergy.com</a> &nbsp;|&nbsp; web: <a href="https://slnkoprotrac.com" target="_blank">slnkoprotrac.com</a></p>
    </div>
  </div>

  <div class="titlebar"><div></div><h1>Customer Payment Summary</h1></div>

  <!-- Project details -->
  <div class="pd">
    <h3>Project Details</h3>
    <div class="pd-grid">
      <div class="field"><p class="label">Project ID</p><p class="value">${
        PD.code
      }</p></div>
      <div class="field"><p class="label">Project Name</p><p class="value">${
        PD.name
      }</p></div>
      <div class="field"><p class="label">Client Name</p><p class="value">${
        PD.customer_name
      }</p></div>
      <div class="field"><p class="label">Group Name</p><p class="value">${
        PD.p_group
      }</p></div>
      <div class="field"><p class="label">Plant Location</p><p class="value">${
        PD.site_address
      }</p></div>
      <div class="field"><p class="label">Plant Capacity (MW)</p><p class="value">${
        PD.project_kwp
      }</p></div>
    </div>
  </div>

  <!-- CREDIT -->
  <div class="section"><h2 class="section-title">Credit History</h2></div>
  <table>
    <colgroup><col style="width:44px"><col style="width:100px"><col><col style="width:120px"></colgroup>
    <thead>
      <tr><th>S.No</th><th>Credit Date</th><th class="left">Mode</th><th>Amount (₹)</th></tr>
    </thead>
    <tbody>${creditRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="3" class="left" style="text-align:right;">Total Credited</td><td class="num nowrap">₹ ${inr(
        creditTotal
      )}</td></tr>
    </tfoot>
  </table>

  <!-- DEBIT -->
  <div class="section"><h2 class="section-title">Debit History</h2></div>
  <table>
    <colgroup><col style="width:44px"><col style="width:100px"><col style="width:140px"><col><col><col style="width:110px"><col style="width:150px"></colgroup>
    <thead>
      <tr><th>S.No</th><th>Date</th><th>PO Number</th><th class="left">Paid For</th><th class="left">Paid To</th><th>UTR</th><th>Amount (₹)</th></tr>
    </thead>
    <tbody>${debitRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="6" class="left" style="text-align:right;">Total Debited</td><td class="num nowrap">₹ ${inr(
        debitTotal
      )}</td></tr>
    </tfoot>
  </table>

  <!-- PURCHASE -->
  <div class="section"><h2 class="section-title">Purchase History</h2></div>
  <table class="po-table">
    <colgroup>
      <col style="width:44px">
      <col style="width:160px">
      <col style="width:180px">
      <col style="width:180px">
      <col style="width:110px"><col style="width:110px"><col style="width:120px">
      <col style="width:130px"><col style="width:140px">
      <col style="width:110px"><col style="width:110px"><col style="width:120px">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">S.No</th>
        <th rowspan="2" class="left">PO Number</th>
        <th rowspan="2" class="left">Vendor</th>
        <th rowspan="2" class="left">Item</th>
        <th colspan="3">PO Value (₹)</th>
        <th rowspan="2">Advance Paid (₹)</th>
        <th rowspan="2">Advance Remaining (₹)</th>
        <th colspan="3">Total Billed (₹)</th>
      </tr>
      <tr>
        <th>Basic (₹)</th><th>GST (₹)</th><th>Total (₹)</th>
        <th>Basic (₹)</th><th>GST (₹)</th><th>Total (₹)</th>
      </tr>
    </thead>
    <tbody>${purchaseRows || ""}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="left" style="text-align:right;font-weight:800;">Total:</td>
        <td class="num nowrap strong">₹ ${inr(po_basic_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(po_gst_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(po_total_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(adv_paid_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(adv_remaining_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(billed_basic_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(billed_gst_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(billed_total_sum)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- SALES (Bill Basic OUTSIDE the grouped Sales box) -->
  <div class="section"><h2 class="section-title">Sales History</h2></div>
  <table class="sales-group">
    <colgroup>
      <col style="width:44px">
      <col style="width:200px">
      <col style="width:100px">
      <col style="width:190px">
      <col style="width:220px">
      <col style="width:120px"><!-- Bill Basic (standalone) -->
      <col style="width:120px"><col style="width:110px"><col style="width:140px"><!-- grouped: Value, GST, Total -->
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">S.No</th>
        <th rowspan="2">PO Number</th>
        <th rowspan="2">Conversion Date</th>
        <th rowspan="2" class="left">Vendor</th>
        <th rowspan="2" class="left">Item Name</th>
        <th rowspan="2">Bill Basic (₹)</th>
        <th class="group-head" colspan="3">Sales</th>
      </tr>
      <tr>
        <th class="group-head">Value (₹)</th>
        <th class="group-head">GST (₹)</th>
        <th class="group-head">Total Sales (₹)</th>
      </tr>
    </thead>
    <tbody>${salesRows || ""}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="left" style="text-align:right;font-weight:800;">Total:</td>
        <td class="num nowrap strong">₹ ${inr(sales_bill_basic_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(sales_value_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(sales_gst_sum)}</td>
        <td class="num nowrap strong">₹ ${inr(sales_total_sum)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- ADJUSTMENT -->
  <div class="section"><h2 class="section-title">Adjustment History</h2></div>
  <table>
    <colgroup><col style="width:44px"><col style="width:100px"><col style="width:140px"><col style="width:120px"><col style="width:140px"><col><col style="width:120px"><col style="width:120px"></colgroup>
    <thead>
      <tr><th>S.No</th><th>Date</th><th class="left">Reason</th><th>PO Number</th><th class="left">Paid For</th><th class="left">Description</th><th>Credit Adjust (₹)</th><th>Debit Adjust (₹)</th></tr>
    </thead>
    <tbody>${adjustRows || ""}</tbody>
    <tfoot>
      <tr><td colspan="6" class="left" style="text-align:right;">Totals</td><td class="num nowrap">₹ ${inr(
        adj_credit_total
      )}</td><td class="num nowrap">₹ ${inr(adj_debit_total)}</td></tr>
    </tfoot>
  </table>


 <!-- always start Balance Summary on a new page -->
<div class="pagebreak"></div>

<h3 style="margin:12px 0 6px;">Balance Summary</h3>
<div class="bs-card">
  <table>
    <thead>
      <tr><th style="width:42px;">S.No.</th><th class="left">Description</th><th>Value</th></tr>
    </thead>
    <tbody>
      ${section1Rows}
      <tr class="billing-title"><td colspan="3">Billing Details</td></tr>
      ${billingRowsHtml}
    </tbody>
  </table>
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
      format: PAGE_FORMAT,
      landscape: ORIENTATION === "landscape",
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

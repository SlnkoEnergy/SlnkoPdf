// controllers/scopePdf.js
const { PDFDocument } = require("pdf-lib");
const generateScopeSheet = require("../services/scope.services");

const ALLOWED_FORMATS = new Set([
  "A0",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "LETTER",
  "LEGAL",
  "TABLOID",
]);

const normalizePdfOptions = (opts = {}) => {
  const out = {};

  if (opts.format) {
    const upper = String(opts.format).trim().toUpperCase();
    if (ALLOWED_FORMATS.has(upper)) {
      out.format = /^A\d$/.test(upper)
        ? upper
        : upper === "LETTER"
        ? "Letter"
        : upper === "LEGAL"
        ? "Legal"
        : upper === "TABLOID"
        ? "Tabloid"
        : "A4";
    } else {
      out.format = "A4";
    }
  } else {
    out.format = "A4";
  }

  if (typeof opts.landscape === "string") {
    const v = opts.landscape.toLowerCase();
    out.landscape = v === "true" || v === "landscape";
  } else {
    out.landscape = !!opts.landscape;
  }

  return out;
};

const normalizeColumns = (cols) => {
  if (!Array.isArray(cols)) return null;
  const out = [];
  const seen = new Set();

  for (const c of cols) {
    let key, label;
    if (typeof c === "string") {
      key = c.trim();
      label = null;
    } else if (c && typeof c === "object" && c.key) {
      key = String(c.key).trim();
      label = c.label ? String(c.label) : null;
    }
    if (!key || seen.has(key)) continue;
    out.push({ key, label });
    seen.add(key);
  }
  return out.length ? out : null;
};

const scopePdf = async (req, res) => {
  try {
    const { scopes = [], pdfOptions = {}, columns } = req.body;

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ message: "No scope data provided" });
    }

    const normalizedPdfOptions = normalizePdfOptions(pdfOptions);
    const normalizedColumns = normalizeColumns(columns);
    const mergedPdfDoc = await PDFDocument.create();

    for (const scope of scopes) {
      const createdBy = scope?.createdBy?.name || "-";
      const status = scope?.current_status?.status || "-";
      const items = scope?.items || [];
      const rows = scope?.rows || [];
      const project = scope?.project || {};
      const camMember = scope?.handover?.cam_member_name || "-";
      const projectStatus = scope?.project_status || "-";

      const buffer = await generateScopeSheet(scope, {
        createdBy,
        status,
        items,
        rows,
        project,
        camMember,
        projectStatus,
        pdfOptions: normalizedPdfOptions,
        columns: normalizedColumns,
      });

      const singlePdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdfDoc.copyPages(
        singlePdf,
        singlePdf.getPageIndices()
      );
      copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
    }

    const finalUint8 = await mergedPdfDoc.save();
    const finalBuffer = Buffer.from(finalUint8);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Scope_Summary.pdf"`,
      "Content-Length": finalBuffer.length,
    });

    res.send(finalBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      message: "Error generating scope PDF",
      error: error.message,
    });
  }
};

module.exports = scopePdf;

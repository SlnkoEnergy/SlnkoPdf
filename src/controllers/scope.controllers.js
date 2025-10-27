const { PDFDocument } = require("pdf-lib");
const generateScopeSheet = require("../services/scope.services");

const ALLOWED_FORMATS = new Set([
  "A0",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "Letter",
  "Legal",
  "Tabloid",
]);

const normalizePdfOptions = (opts = {}) => {
  const out = {};
  if (opts.format) {
    const val = String(opts.format).trim();
    const upper = val.toUpperCase();
    if (ALLOWED_FORMATS.has(upper)) {
      out.format = upper.match(/^A\d$/)
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
    out.landscape =
      opts.landscape.toLowerCase() === "true" ||
      opts.landscape.toLowerCase() === "landscape";
  } else {
    out.landscape = !!opts.landscape;
  }

  return out;
};

const scopePdf = async (req, res) => {
  try {
    const { scopes = [], pdfOptions = {} } = req.body;

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ message: "No scope data provided" });
    }

    const normalizedPdfOptions = normalizePdfOptions(pdfOptions);
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
      });

      const singlePdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdfDoc.copyPages(
        singlePdf,
        singlePdf.getPageIndices()
      );
      copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
    }

    // Better buffer handling
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

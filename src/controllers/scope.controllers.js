const { PDFDocument } = require("pdf-lib");
const generateScopeSheet = require("../services/scope.services");


const scopePdf = async (req, res) => {
  try {
    const { scopes = [] } = req.body;

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ message: "No scope data provided" });
    }

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
      });

      const singlePdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdfDoc.copyPages(singlePdf, singlePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
    }

    const finalPdfBuffer = await mergedPdfDoc.save();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Scope_Summary.pdf"`,
      "Content-Length": finalPdfBuffer.length,
    });

    res.send(Buffer.from(finalPdfBuffer));
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      message: "Error generating scope PDF",
      error: error.message,
    });
  }
};

module.exports = scopePdf;

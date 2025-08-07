const generateExpenseSheet = require("../services/expensePdfServices");
const { PDFDocument } = require("pdf-lib");

const expensePdf = async (req, res) => {
  try {
    const { sheets = [], printAttachments = false } = req.body;

    if (!Array.isArray(sheets) || sheets.length === 0) {
      return res.status(400).json({ message: "No sheets provided" });
    }

    const mergedPdfDoc = await PDFDocument.create();

    for (const sheet of sheets) {
      const department = sheet?.user_id?.department || "";
      const attachmentLinks = sheet.items
        ?.map((item) => item.attachment_url)
        .filter((url) => url && url.startsWith("http")) || [];
      const buffer = await generateExpenseSheet(sheet, {
        department,
        printAttachments,
        attachmentLinks,
      });

      const singlePdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdfDoc.copyPages(singlePdf, singlePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
    }

    const finalPdfBuffer = await mergedPdfDoc.save();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Multiple_Expenses.pdf"`,
      "Content-Length": finalPdfBuffer.length,
    });

    res.send(Buffer.from(finalPdfBuffer));
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ message: "Error generating PDF", error: error.message });
  }
};


module.exports = expensePdf;

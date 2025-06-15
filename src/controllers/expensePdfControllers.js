const generateExpenseSheet = require("../services/expensePdfServices");

const expensePdf = async (req, res) => {
  try {
    const sheet = req.body.sheet; // Expecting sheet under 'sheet'
    const printAttachments = req.body.printAttachments || false;
    const attachmentLinks = req.body.attachmentLinks || [];

    if (!sheet || !sheet.expense_code) {
      return res.status(400).json({ message: "Invalid or missing expense sheet data" });
    }

    const department = sheet?.user_id?.department || "";
    
    const pdfBuffer = await generateExpenseSheet(sheet, {
      department,
      printAttachments,
      attachmentLinks,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Expense_${sheet.expense_code}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: "Error generating PDF", error: error.message });
  }
};

module.exports = expensePdf;

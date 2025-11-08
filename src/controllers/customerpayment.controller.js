const generateCustomerPaymentSheet = require("../services/customerpaymentsummary.services");

const CustomerPaymentpdf = async (req, res) => {
  try {
    const {
      projectDetails = {},
      creditHistorys = [],
      DebitHistorys = [],
      purchaseHistorys = [],
      saleHistorys = [],
      AdjustmentHistorys = [],
      balanceSummary = {},
    } = req.body || {};
    const credits = Array.isArray(creditHistorys) ? creditHistorys : [];
    const debits = Array.isArray(DebitHistorys) ? DebitHistorys : [];
    const purchases = Array.isArray(purchaseHistorys) ? purchaseHistorys : [];
    const sales = Array.isArray(saleHistorys) ? saleHistorys : [];
    const adjusts = Array.isArray(AdjustmentHistorys) ? AdjustmentHistorys : [];
    const summary =
      balanceSummary && typeof balanceSummary === "object"
        ? balanceSummary
        : {};

    const pdfBuffer = await generateCustomerPaymentSheet(
      projectDetails,
      credits,
      debits,
      purchases,
      sales,
      adjusts,
      summary
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Payment_History.pdf"'
    );
    res.setHeader("Content-Length", Buffer.byteLength(pdfBuffer));
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      message: "Error Generating Payment History PDF",
      error: error.message,
    });
  }
};

module.exports = CustomerPaymentpdf;

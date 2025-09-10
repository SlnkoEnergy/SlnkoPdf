const generateCustomerPaymentSheet = require("../services/customerpaymentsummary.services")

const CustomerPaymentpdf = async (req, res) => {
    try {
        const { creditHistorys = [], DebitHistorys = [], purchaseHistorys = [], AdjustmentHistorys = [] } = req.body;

        const finalPdfBuffer = await generateCustomerPaymentSheet(creditHistorys, DebitHistorys, purchaseHistorys, AdjustmentHistorys);

        res.set({
            "Content-Type": "application/pdf",
            "Content-disposition": `attachment; filename = "Payment_History.pdf"`,
            "Content-Length": finalPdfBuffer.length,
        });
        res.send(Buffer.from(finalPdfBuffer));


    } catch (error) {

        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Error Generating Payment History PDF", error: error.message });
    }
}

module.exports = CustomerPaymentpdf;
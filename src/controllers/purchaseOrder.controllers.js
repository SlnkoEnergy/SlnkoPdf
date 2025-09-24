const generatePurchaseOrderSheet = require("../services/purchaseOrder.services");

const purchaseOrderPdf = async (req, res) => {
    try {

        const { Purchase = [], orderNumber, vendorName, Date, project_id, message } = req.body;

        if (!Array.isArray(Purchase) || Purchase.length === 0) {
            return res.status(400).json({ message: "No Purchase Data Provided" });
        }

        const finalPdfBuffer = await  generatePurchaseOrderSheet(Purchase, orderNumber, vendorName, Date, project_id, message);

        res.set({
            "Content-Type": "application/pdf",
            "Content-disposition": `attachment; filename = "Purchase_Order.pdf"`,
            "Content-Length": finalPdfBuffer.length,
        })
        
        res.send(Buffer.from(finalPdfBuffer));
    } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Error Generating Payment History PDF", error: error.message });
    }
}

module.exports = purchaseOrderPdf;
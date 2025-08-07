const generatePaymentApprovalSheet = require("../services/poapproval.services");

const poapprovalPdf = async( req, res) => {
    try {
        const { Pos = [] } = req.body;

        if(!Array.isArray(Pos) || Pos.length === 0){
            return res.status(400).json({ message: "No PO data Provided"});
        }

        const finalPdfBuffer = await generatePaymentApprovalSheet(Pos);
        

        res.set({
            "Content-Type" : "application/pdf",
            "Content-disposition": `attachment; filename = "Multiple_Po.pdf"`,
            "Content-Length": finalPdfBuffer.length,
        });

        res.send(Buffer.from(finalPdfBuffer));
    } catch (error) {
        console.error("PDF generation error:" , error);
        res.status(500).json({message: "Error generating PO PDF", error: error.message})
    }
};
module.exports = poapprovalPdf;
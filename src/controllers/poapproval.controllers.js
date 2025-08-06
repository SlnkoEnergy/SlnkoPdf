const { PDFDocument } = require("pdf-lib");
const generatePaymentApprovalSheet = require("../services/poapproval.services");

const poapprovalPdf = async( req, res) => {
    try {
        const { Pos = [] } = req.body;

        if(!Array.isArray(Pos) || Pos.length === 0){
            return res.status(400).json({ message: "No PO data Provided"});
        }

        const mergedPdfDoc = await PDFDocument.create();

        for(const Po of Pos) {
            const buffer = await generatePaymentApprovalSheet(Po);

            const singlePdf = await PDFDocument.load(buffer);
            const copiedPages = await mergedPdfDoc.copyPages(singlePdf, singlePdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
        }
         
        const finalPdfBuffer = await mergedPdfDoc.save();

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
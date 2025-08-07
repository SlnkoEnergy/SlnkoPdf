const generatepaymenthistorySheet = require("../services/paymenthistory.services");

const paymenthistorypdf = async(req , res) =>{
    try {
        const {Payments = []} = req.body;

        if(!Array.isArray(Payments) || Payments.length === 0){
            return res.status(400).json({message: "No Payment Data Provided"});
        }

        const finalPdfBuffer = await generatepaymenthistorySheet(Payments);

        res.set({
            "Content-Type" : "application/pdf",
            "Content-disposition" : `attachment; filename = "Payment_History.pdf"`,
            "Content-Length": finalPdfBuffer.length,
        });
        res.send(Buffer.from(finalPdfBuffer));

    } catch (error) {
        console.error("PDF generation error:", error );
        res.status(500).json({message: "Error Generating Payment History PDF", error: error.message});
    }
}

module.exports  = paymenthistorypdf;
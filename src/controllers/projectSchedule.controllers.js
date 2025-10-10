const generateProjectSchedulePdf = require("../services/projectSchedule.services");

const projectSchedulepdf = async(req, res) =>{

    try {
        
        const {data = [], project_code, project_name, customer, state} = req.body;

        if( data.length === 0){
            return res.status(400).json({message: "No Project Data Provided"})
        }

        const finalPdfBuffer = await generateProjectSchedulePdf(data, project_code, project_name, customer, state);

        res.set({
            "Content-Type" : "application/pdf",
            "Content-disposition":  `attachment; filename = "Project_Schedule.pdf"`,
            "Content-Length": finalPdfBuffer.length,
        });
        res.send(Buffer.from(finalPdfBuffer));
    } catch (error) {
        console.error("Pdf generation error:", error);
        res.status(500).json({message: "Error Generating Project Schedule PDF", error: error.message});     
    }

}

module.exports = projectSchedulepdf;    
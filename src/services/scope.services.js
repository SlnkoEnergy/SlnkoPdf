const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

async function generateScopeSheet(scope, options = {}) {
  const {
    project = {}
  } = options;
  const itemsHTML = (scope.items || [])
    .map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name || "-"}</td>
        <td>${item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase() : "-"}</td>
        <td>${item.quantity ?? "-"}</td>
        <td>${item.uom || "-"}</td>
       <td>${item.scope ? item.scope.charAt(0).toUpperCase() + item.scope.slice(1).toLowerCase() : "-"}</td>
      </tr>
    `).join("");

  const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .watermark {
          position: fixed;
          top: 50%;
          left: 12%;
          transform: rotate(-45deg);
          font-size: 100px;
          color: rgba(0,0,0,0.05);
          z-index: -1;
        }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .header img { max-height: 50px; max-width: 150px; object-fit: contain; }
        h2.title { text-align: center; margin-bottom: 20px; font-size: 22px; text-transform: uppercase; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info div { font-size: 14px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #000; padding: 6px; text-align: center; }
        td.left { text-align: left; }
        .summary-table { margin-top: 30px; width: 50%; font-size: 12px; margin-left: auto; margin-right: auto; }
      </style>
    </head>
    <body>
      <div class="watermark">Slnko Energy</div>
      <div class="header">
        <img src="${logoSrc}" alt="Slnko Logo" />
      </div>
      <h2 class="title">Scope Of Work</h2>
      <div class="info">
        <div>
          <strong>Project Name:</strong> ${project.name || "-"}<br>
          <strong>Project Code:</strong> ${project.code || "-"}<br>
          <strong>Created By:</strong> ${scope.createdBy?.name || "-"}
        </div>
        <div>
          <strong>Created Date:</strong> ${new Date(scope.updatedAt).toLocaleDateString("en-IN")}<br>
          <strong>Last Updated Date:</strong> ${new Date(scope.updatedAt).toLocaleDateString("en-IN")}<br>
          <strong>Total Categories:</strong> ${(scope.items || []).length}<br>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Name</th>
            <th>Type</th>
            <th>Tentative Quantity</th>
            <th>UoM</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "10mm", left: "2mm", right: "2mm" },
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = generateScopeSheet;

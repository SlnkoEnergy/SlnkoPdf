const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");
const https = require("https");
const http = require("http");
const os = require("os");
const { convert } = require("pdf-poppler");
const { PDFDocument } = require("pdf-lib");

// Fetch image as base64 from a URL
async function fetchBase64FromUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers["content-type"] || "image/png";
        const base64 = buffer.toString("base64");
        resolve(`data:${contentType};base64,${base64}`);
      });
    }).on("error", reject);
  });
}

async function convertPdfToJpegs(pdfPath) {
  const outputDir = path.dirname(pdfPath);
  const opts = {
    format: "jpeg",
    out_dir: outputDir,
    out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
    page: null,
  };
  await convert(pdfPath, opts);
  const files = await fs.readdir(outputDir);
  return files
    .filter((f) => /\.jpe?g$/i.test(f))
    .map((f) => path.join(outputDir, f));
}

// Convert image buffer to single-page PDF buffer
async function imageBufferToPdf(buf, mimeType) {
  const pdfDoc = await PDFDocument.create();
  let img = mimeType.includes("png")
    ? await pdfDoc.embedPng(buf)
    : await pdfDoc.embedJpg(buf);
  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return pdfDoc.save();
}

async function generateExpenseSheet(sheet, options = {}) {
  // Load local logo as base64

    const {
    department = "",
    printAttachments = false,
    attachmentLinks = [],
    attachments = [],
  } = options;


  const logoPath = path.resolve(__dirname, "../assets/1.png");
  const logoData = fs.readFileSync(logoPath).toString("base64");
  const logoSrc = `data:image/png;base64,${logoData}`;

  // Prepare summary of categories
  const summaryMap = {};
  let totalApproved = 0;
  let totalRequested = 0;
  (sheet.items || []).forEach((item) => {
    const category = item.category || "Others";
    const approved = Number(item.approved_amount) || 0;
    const requested = Number(item.invoice?.invoice_amount) || 0;
    if (!summaryMap[category]) summaryMap[category] = { approved: 0, requested: 0 };
    summaryMap[category].approved += approved;
    summaryMap[category].requested += requested;
    totalApproved += approved;
    totalRequested += requested;
  });

  const summaryRows = Object.entries(summaryMap)
    .map(([category, amounts]) => `
      <tr>
        <td style="border:1px solid #000; padding:6px; text-align:left;">${category}</td>
        <td style="border:1px solid #000; padding:6px; text-align:right;">${amounts.requested.toFixed(2)}</td>
        <td style="border:1px solid #000; padding:6px; text-align:right;">${amounts.approved.toFixed(2)}</td>
      </tr>
    `).join("");

  const summaryTotalRow = `
    <tr>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:left;">Total</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalRequested.toFixed(2)}</td>
      <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:right;">${totalApproved.toFixed(2)}</td>
    </tr>
  `;

  // Build item rows
  const itemsHTML = (sheet.items || [])
    .map((item, i) => {
      const projectName = item.project_id?.name || "";
      const projectCode = item.project_id?.code || "";
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${projectCode}</td>
          <td>${projectName}</td>
          <td>${item.category || "-"}</td>
          <td class="left">${item.description || "-"}</td>
          <td>${item.expense_date ? new Date(item.expense_date).toLocaleDateString("en-IN") : "-"}</td>
          <td>${item.invoice?.invoice_amount ?? "-"}</td>
          <td>${item.approved_amount ?? "-"}</td>
        </tr>
      `;
    }).join("");

  // Format dates
  const fromDate = new Date(sheet.expense_term.from).toLocaleDateString("en-IN");
  const toDate = new Date(sheet.expense_term.to).toLocaleDateString("en-IN");

  // Handle attachments if required
let attHTML = "";
  if (printAttachments && attachmentLinks.length) {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "att-"));
    for (const url of attachmentLinks) {
      try {
        const isPdf = /\.pdf(\?.*)?$/i.test(url);
        if (isPdf) {
          // download PDF
          const pdfData = await fetchBase64FromUrl(url);
          const buf = Buffer.from(pdfData.split(",")[1], "base64");
          const tempPdf = path.join(temp, path.basename(url.split("?")[0]));
          await fs.writeFile(tempPdf, buf);

          // convert PDF pages to images
          const images = await convertPdfToJpegs(tempPdf);
          for (const img of images) {
            const img64 = await fs.readFile(img);
            const data64 = `data:image/jpeg;base64,${img64.toString("base64")}`;
            attHTML += `<img src="${data64}" style="max-width:100%; margin:10px 0;" />`;
          }
        } else {
          const img64 = await fetchBase64FromUrl(url);
          attHTML += `<img src="${img64}" style="max-width:100%; margin:10px 0;" />`;
        }
      } catch (e) {
        console.error("Attachment error", e);
      }
    }
    await fs.remove(temp);
  }

    
  

  // Complete HTML template
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
        .info div { width: 32%; font-size: 14px; line-height: 1.6; }
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
      <h2 class="title">Expense Sheet</h2>
      <h2 class="title">${sheet.expense_code}</h2>
      <div class="info">
        <div>
          <strong>Employee Name:</strong> ${sheet.emp_name}<br>
          <strong>Employee Code:</strong> ${sheet.emp_id}<br>
          <strong>Department:</strong> ${department}
        </div>
        <div>
          <strong>Expense Period:</strong><br>
          From: ${fromDate}<br>
          To: ${toDate}
        </div>
        <div>
          <strong>Mobile Number:</strong> ${sheet.user_id.phone}<br>
          <strong>Sheet Current Status:</strong> ${sheet.current_status}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Project Code</th>
            <th>Site Name</th>
            <th>Category</th>
            <th>Description</th>
            <th>Date</th>
            <th>Requested Amount</th>
            <th>Approved Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      <div class="summary-table">
        <h3>Summary</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Category Type</th>
              <th>Requested Amount</th>
              <th>Approved Amount</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
            ${summaryTotalRow}
          </tbody>
        </table>
      </div>
      ${attHTML}
    </body>
    </html>
  `;

  // Puppeteer launch options
   const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  const mainPdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10px", bottom: "10px", left: "10px", right: "10px" },
  });
  await browser.close();

  // Merge any extra attachments passed directly as Buffers (attachments[])
  if (!Array.isArray(options.attachments) || options.attachments.length === 0) {
    return mainPdf;
  }

  const merged = await PDFDocument.create();
  const mainDoc = await PDFDocument.load(mainPdf);
  (await merged.copyPages(mainDoc, mainDoc.getPageIndices())).forEach((p) =>
    merged.addPage(p)
  );

  // attachments buffers
  for (const att of options.attachments) {
    if (att.type === "pdf") {
      const doc = await PDFDocument.load(att.buffer);
      (await merged.copyPages(doc, doc.getPageIndices())).forEach((p) =>
        merged.addPage(p)
      );
    } else if (att.type === "image") {
      const imgPdf = await imageBufferToPdf(att.buffer, att.mimeType);
      const doc = await PDFDocument.load(imgPdf);
      (await merged.copyPages(doc, doc.getPageIndices())).forEach((p) =>
        merged.addPage(p)
      );
    }
  }

  return merged.save();
}

module.exports = generateExpenseSheet;


// const puppeteer = require("puppeteer");
// const path = require("path");
// const fs = require("fs-extra");
// const https = require("https");
// const http = require("http");
// const os = require("os");
// const { convert } = require("pdf-poppler");
// const { PDFDocument } = require("pdf-lib");

// // Fetch remote image and return base64 data URI
// async function fetchBase64FromUrl(url) {
//   return new Promise((resolve, reject) => {
//     const lib = url.startsWith("https") ? https : http;
//     lib.get(url, (response) => {
//       if (response.statusCode !== 200) {
//         return reject(new Error(`Failed to fetch ${url} (${response.statusCode})`));
//       }
//       const chunks = [];
//       response
//         .on("data", (c) => chunks.push(c))
//         .on("end", () => {
//           const buf = Buffer.concat(chunks);
//           const type = response.headers["content-type"] || "application/octet-stream";
//           resolve(`data:${type};base64,${buf.toString("base64")}`);
//         })
//         .on("error", reject);
//     }).on("error", reject);
//   });
// }

// // Convert PDF file to JPEG images, return array of file paths
// async function convertPdfToJpegs(pdfPath) {
//   const outputDir = path.dirname(pdfPath);
//   const opts = {
//     format: "jpeg",
//     out_dir: outputDir,
//     out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
//     page: null,
//   };
//   await convert(pdfPath, opts);
//   const files = await fs.readdir(outputDir);
//   return files
//     .filter((f) => /\.jpe?g$/i.test(f))
//     .map((f) => path.join(outputDir, f));
// }

// // Convert image buffer to single-page PDF buffer
// async function imageBufferToPdf(buf, mimeType) {
//   const pdfDoc = await PDFDocument.create();
//   let img = mimeType.includes("png")
//     ? await pdfDoc.embedPng(buf)
//     : await pdfDoc.embedJpg(buf);
//   const page = pdfDoc.addPage([img.width, img.height]);
//   page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
//   return pdfDoc.save();
// }

// // Main function: builds HTML, embeds attachments, returns Buffer
// async function generateExpenseSheet(sheet, options = {}) {
//   const {
//     department = "",
//     printAttachments = false,
//     attachmentLinks = [],
//     attachments = [],
//   } = options;

//   // Prepare logo
//   const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
//   const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

//   // Build table rows
//   let totalReq = 0, totalApp = 0;
//   const summary = {};
//   const itemsHTML = (sheet.items || [])
//     .map((it, i) => {
//       const category = it.category || "Others";
//       const req = Number(it.invoice?.invoice_amount) || 0;
//       const app = Number(it.approved_amount) || 0;
//       summary[category] = summary[category] || { req: 0, app: 0 };
//       summary[category].req += req;
//       summary[category].app += app;
//       totalReq += req;
//       totalApp += app;

//       const date = it.expense_date
//         ? new Date(it.expense_date).toLocaleDateString("en-IN")
//         : "-";

//       return `
//         <tr>
//           <td>${i + 1}</td>
//           <td>${it.project_id?.code || "-"}</td>
//           <td>${it.project_id?.name || "-"}</td>
//           <td>${category}</td>
//           <td>${it.description || "-"}</td>
//           <td>${date}</td>
//           <td>${req}</td>
//           <td>${app}</td>
//         </tr>`;
//     })
//     .join("");

//   const summaryRows = Object.entries(summary)
//     .map(
//       ([cat, o]) => `
//     <tr>
//       <td>${cat}</td>
//       <td>${o.req}</td>
//       <td>${o.app}</td>
//     </tr>`
//     )
//     .join("");

//   // Build attachments section into HTML
//   let attHTML = "";
//   if (printAttachments && attachmentLinks.length) {
//     const temp = await fs.mkdtemp(path.join(os.tmpdir(), "att-"));
//     for (const url of attachmentLinks) {
//       try {
//         const isPdf = /\.pdf(\?.*)?$/i.test(url);
//         if (isPdf) {
//           // download PDF
//           const pdfData = await fetchBase64FromUrl(url);
//           const buf = Buffer.from(pdfData.split(",")[1], "base64");
//           const tempPdf = path.join(temp, path.basename(url.split("?")[0]));
//           await fs.writeFile(tempPdf, buf);

//           // convert PDF pages to images
//           const images = await convertPdfToJpegs(tempPdf);
//           for (const img of images) {
//             const img64 = await fs.readFile(img);
//             const data64 = `data:image/jpeg;base64,${img64.toString("base64")}`;
//             attHTML += `<img src="${data64}" style="max-width:100%; margin:10px 0;" />`;
//           }
//         } else {
//           const img64 = await fetchBase64FromUrl(url);
//           attHTML += `<img src="${img64}" style="max-width:100%; margin:10px 0;" />`;
//         }
//       } catch (e) {
//         console.error("Attachment error", e);
//       }
//     }
//     await fs.remove(temp);
//   }

//   // Base HTML template
//   const html = `
//     <!DOCTYPE html>
//     <html><head><style>
//       body {font-family:Arial;margin:40px;}
//       .header, .info {display:flex;justify-content:space-between;}
//       table {width:100%;border-collapse:collapse;margin-top:20px;}
//       th,td {border:1px solid #000;padding:8px;text-align:center;}
//       .summary {width:50%;margin:30px auto;}
//     </style></head><body>
//       <div class="header">
//         <img src="${logoSrc}" style="height:50px;" />
//         <h2>Expense Sheet: ${sheet.expense_code}</h2>
//         <span>${department}</span>
//       </div>
//       <div class="info">
//         <div><strong>Emp:</strong> ${sheet.emp_name} (${sheet.emp_id})</div>
//         <div><strong>Period:</strong> ${new Date(sheet.expense_term.from).toLocaleDateString("en-IN")} – ${new Date(sheet.expense_term.to).toLocaleDateString("en-IN")}</div>
//         <div><strong>Status:</strong> ${sheet.current_status || "-"}</div>
//       </div>
//       <table>
//         <thead><tr><th>S</th><th>Code</th><th>Name</th><th>Category</th><th>Description</th><th>Date</th><th>Req</th><th>App</th></tr></thead>
//         <tbody>${itemsHTML}</tbody>
//       </table>
//       <table class="summary">
//         <thead><tr><th>Category</th><th>Req Total</th><th>App Total</th></tr></thead>
//         <tbody>${summaryRows}</tbody>
//         <tfoot><tr><td><strong>Total</strong></td><td>${totalReq}</td><td>${totalApp}</td></tr></tfoot>
//       </table>
//       ${attHTML}
//     </body></html>`;

//   // Generate main PDF with Puppeteer
//   const browser = await puppeteer.launch({
//     headless: "new",
//     args: ["--no-sandbox", "--disable-setuid-sandbox"],
//   });
//   const page = await browser.newPage();
//   await page.setContent(html, { waitUntil: "networkidle0" });
//   const mainPdf = await page.pdf({
//     format: "A4",
//     printBackground: true,
//     margin: { top: "10px", bottom: "10px", left: "10px", right: "10px" },
//   });
//   await browser.close();

//   // Merge any extra attachments passed directly as Buffers (attachments[])
//   if (!Array.isArray(options.attachments) || options.attachments.length === 0) {
//     return mainPdf;
//   }

//   const merged = await PDFDocument.create();
//   const mainDoc = await PDFDocument.load(mainPdf);
//   (await merged.copyPages(mainDoc, mainDoc.getPageIndices())).forEach((p) =>
//     merged.addPage(p)
//   );

//   // attachments buffers
//   for (const att of options.attachments) {
//     if (att.type === "pdf") {
//       const doc = await PDFDocument.load(att.buffer);
//       (await merged.copyPages(doc, doc.getPageIndices())).forEach((p) =>
//         merged.addPage(p)
//       );
//     } else if (att.type === "image") {
//       const imgPdf = await imageBufferToPdf(att.buffer, att.mimeType);
//       const doc = await PDFDocument.load(imgPdf);
//       (await merged.copyPages(doc, doc.getPageIndices())).forEach((p) =>
//         merged.addPage(p)
//       );
//     }
//   }

//   return merged.save();
// }

// module.exports = generateExpenseSheet;



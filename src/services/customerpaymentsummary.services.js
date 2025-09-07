const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs-extra");

async function generateCustomerPaymentSheet(creditHistorys, DebitHistorys, purchaseHistorys, AdjustmentHistorys) {
  try {
    const itemsHTML = (creditHistorys || []).map((creditHistory, i) => {
      return `
                        <tr>
                               <td>${i + 1}</td>
                            <td>${
                             creditHistory.CreditDate
                            }</td>
                            <td>${creditHistory.mode}</td>
                            <td>${creditHistory.amount}</td>
                            
                        </tr> 
                `;
    });

    const itemsHTMLDebit = (DebitHistorys || []).map((DebitHistory, i) => {
      return `
                        <tr>
                               <td>${i + 1}</td>
                            <td>${
                             DebitHistory.date
                            }</td>
                            <td>${DebitHistory.po_number}</td>
                            <td>${DebitHistory.paid_for}</td>
                            <td>${DebitHistory.paid_to}</td>
                            <td>${DebitHistory.amount}</td>
                            <td>${DebitHistory.utr}</td>
                        </tr> 
                `;
    });

    const itemsHTMLPurchase = (purchaseHistorys || []).map((purchaseHistory, i) => {
      return `
                        <tr>
                               <td>${i + 1}</td>
                            <td>${
                             purchaseHistory.po_number
                            }</td>
                            <td>${purchaseHistory.vendor}</td>
                            <td>${purchaseHistory.item_name}</td>
                            <td>${purchaseHistory.Po_value}</td>
                            <td>${purchaseHistory.Advance_paid}</td>
                            <td>${purchaseHistory.remain_amount}</td>
                            <td>${purchaseHistory.total_billed_value}</td>
                        </tr> 
                `;
    });

    const itemsHTMLAdjust = (AdjustmentHistorys || []).map((AdjustmentHistory, i) => {
      return `
                        <tr>
                               <td>${i + 1}</td>
                            <td>${
                             AdjustmentHistory.date
                            }</td>
                            <td>${AdjustmentHistory.reason}</td>
                            <td>${AdjustmentHistory.po_number}</td>
                            <td>${AdjustmentHistory.paid_for}</td>
                            <td>${AdjustmentHistory.description}</td>
                            <td>${AdjustmentHistory.credit_adjust}</td>
                            <td>${AdjustmentHistory.debit_adjust}</td>
                        </tr> 
                `;
    });

    const logoData = fs.readFileSync(path.resolve(__dirname, "../assets/1.png"));
    const logoSrc = `data:image/png;base64, ${logoData.toString("base64")}`;

    const htmlContent = `
    
    `
  } catch (error) {}
}

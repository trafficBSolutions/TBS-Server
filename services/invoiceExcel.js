// services/invoiceExcel.js
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { currentTotal, interestStepsSince } = require('../utils/invoiceMath');

async function exportInvoicesXlsx(invoices, jobsById, outDir='./files/exports') {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = `invoices_${Date.now()}.xlsx`;
  const full = path.join(outDir, filename);

  const rows = invoices.map(inv => {
    const job = jobsById.get(String(inv.job));
    const total = currentTotal(inv);
    return {
      InvoiceID: inv._id,
      Company: inv.company,
      JobID: inv.job,
      Project: job?.project || '',
      Status: inv.status,
      SentAt: inv.sentAt || '',
      PaidAt: inv.paidAt || '',
      Principal: inv.principal,
      InterestRateStep: inv.interestRate,
      InterestSteps: interestStepsSince(inv.sentAt),
      TotalToday: total
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, full);
  return full;
}

module.exports = { exportInvoicesXlsx };

// services/receiptPDF.js
const { renderV42Document, loadStdAssets } = require('./v42Base');
const { printHtmlToPdfBuffer } = require('./invoicePDF');
function money(n){ return `$${Number(n||0).toFixed(2)}`; }

function receiptContentHTML({ lines }) {
  // lines: [{label, value}] like Payment Method, Card Type, Last 4, Amount, Remaining Balance, etc.
  const rows = lines.map(l => `
    <tr><td>${l.label}</td><td style="text-align:right;">${l.value}</td></tr>
  `).join('');
  return `
    <table class="table">
      <thead><tr><th>DETAIL</th><th style="text-align:right;">VALUE</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="notes small">This receipt acknowledges payment toward the referenced invoice.</div>`;
}

async function generateReceiptPdf({ job, invoice, payment }) {
  // payment = { method:'card'|'check', amount, cardType, last4, checkNumber, remaining }
  const { logo, cone } = loadStdAssets();

  const methodPretty = payment.method === 'check'
    ? `Check ${payment.checkNumber ? `#${payment.checkNumber}` : ''}`
    : `Card${payment.cardType ? ` (${payment.cardType})` : ''}${payment.last4 ? ` •••• ${payment.last4}` : ''}`;

  const contentHTML = receiptContentHTML({
    lines: [
      { label: 'Invoice #', value: (invoice?._id || '').toString().slice(-6) || '—' },
      { label: 'Payment Method', value: methodPretty },
      { label: 'Payment Amount', value: money(payment.amount) },
      { label: 'Remaining Balance', value: money(payment.remaining ?? 0) },
      { label: 'Paid On', value: new Date().toLocaleString() },
    ]
  });

  const totalsHTML = `
    <div class="totals">
      <div class="row grand"><span>Amount Received</span><span>${money(payment.amount)}</span></div>
    </div>`;

  const html = renderV42Document({
    title: 'RECEIPT',
    coneDataUri: cone,
    logoDataUri: logo,
    companyBox: {
      client: job?.basic?.client,
      address: job?.basic?.address, city: job?.basic?.city, state: job?.basic?.state, zip: job?.basic?.zip,
    },
    metaBox: {
      date: new Date().toLocaleDateString(),
      invoiceNo: (invoice?._id || '').toString().slice(-6)
    },
    billTo: {
      company: job?.basic?.client,
      address: '',
      workType: job?.workType,
      foreman: job?.foreman,
      location: [job?.basic?.address, job?.basic?.city, job?.basic?.state, job?.basic?.zip].filter(Boolean).join(', ')
    },
    contentHTML,
    totalsHTML,
    footerHTML: `<div>Thank you for your payment!</div>`
  });

  return await printHtmlToPdfBuffer(html);
}

module.exports = { generateReceiptPdf };

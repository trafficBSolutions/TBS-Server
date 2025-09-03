// services/invoicePdf.js
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');
const { currentTotal, interestStepsSince } = require('../utils/invoiceMath');

async function generateInvoicePdf(invoice, job, outDir='./files/invoices') {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = `invoice_${invoice._id}.pdf`;
  const full = path.join(outDir, filename);

  const now = new Date();
  const steps = interestStepsSince(invoice.sentAt || now, now);
  const total = currentTotal(invoice, now);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(full));

  doc.fontSize(18).text('Invoice', { align: 'right' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice ID: ${invoice._id}`);
  doc.text(`Company: ${invoice.company}`);
  if (invoice.billedTo?.name) doc.text(`Bill To: ${invoice.billedTo.name}`);
  if (invoice.billedTo?.email) doc.text(`Email: ${invoice.billedTo.email}`);
  doc.text(`Job: ${job.project || ''} (${job._id})`);
  doc.text(`Sent At: ${invoice.sentAt ? new Date(invoice.sentAt).toLocaleString() : '—'}`);
  doc.text(`Status: ${invoice.status}`);
  doc.moveDown();

  doc.text('Line Items');
  doc.moveDown(0.5);
  (invoice.lineItems || []).forEach(li => {
    doc.text(`${li.description}  x${li.qty}  $${li.unitPrice.toFixed(2)}  →  $${li.total.toFixed(2)}`);
  });

  doc.moveDown();
  doc.text(`Principal: $${invoice.principal.toFixed(2)}`);
  doc.text(`Interest Rate (step): ${(invoice.interestRate * 100).toFixed(2)}%`);
  doc.text(`Interest Steps Elapsed: ${steps}`);
  doc.moveDown();
  doc.fontSize(14).text(`Total Due Today: $${total.toFixed(2)}`, { align: 'right' });

  doc.end();
  return full;
}

module.exports = { generateInvoicePdf };

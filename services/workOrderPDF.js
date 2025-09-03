// services/workOrderPdf.js
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');

async function generateWorkOrderPdf(job, outDir='./files/workorders') {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filename = `workorder_${job._id}.pdf`;
  const full = path.join(outDir, filename);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(full));

  doc.fontSize(18).text('Work Order', { align: 'right' });
  doc.moveDown();
  doc.fontSize(12).text(`Company: ${job.company}`);
  doc.text(`Coordinator: ${job.coordinator || ''}`);
  doc.text(`Project/Task #: ${job.project || ''}`);
  doc.text(`Address: ${job.address}, ${job.city}, ${job.state} ${job.zip}`);
  doc.text(`Dates: ${(job.jobDates || []).map(d => new Date(d.date).toLocaleDateString()).join(', ')}`);
  doc.text(`Equipment: ${(job.equipment || []).join(', ')}`);
  if (job.message) doc.moveDown().text(`Notes: ${job.message}`);

  doc.end();
  return full;
}

module.exports = { generateWorkOrderPdf };

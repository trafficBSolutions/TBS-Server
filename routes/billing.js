// routes/billing.js
const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const InvoiceUser = require('../models/controlinvoice'); // your job model
const verifyAdmin = require('../middleware/verifyAdmin');
const requireInvoiceAdmin = require('../middleware/requireInvoiceAdmin');
const { generateWorkOrderPdf } = require('../services/workOrderPDF');
const { generateInvoicePdf } = require('../services/invoicePDF');
const { exportInvoicesXlsx } = require('../services/invoiceExcel');
const { currentTotal } = require('../utils/invoiceMath');
const transporter2 = require('../utils/emailConfig'); // you already have this
const { computeTotalFromSelections } = require('../utils/pricing');
const { billJob, billPlan } = require('../controllers/billControl');
const authJwt = require('../middleware/authJwt');
const cors = require('cors');
router.use(authJwt);
router.use(verifyAdmin);
router.use(requireInvoiceAdmin);
// Companies with submitted jobs (not cancelled)
router.get('/companies', async (req,res) => {
  const companies = await InvoiceUser.aggregate([
    { $match: { cancelled: { $ne: true } } },
    { $group: { _id: '$company' } },
    { $sort: { _id: 1 } }
  ]);
  res.json(companies.map(c => c._id).filter(Boolean));
});

// Create invoice DRAFT from job (only if not cancelled)
router.post('/invoices/from-job/:jobId', async (req,res) => {
  const job = await InvoiceUser.findById(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.cancelled) return res.status(400).json({ message: 'Cancelled job cannot be invoiced' });

  const companyKey = (job.companyKey || ''); // set this when saving jobs
  const priceList = await PriceList.findOne({ companyKey });
  let principalCents;

  if (req.body.selections && priceList) {
    principalCents = computeTotalFromSelections(priceList, req.body.selections);
  } else {
    // manual entry path (still allowed)
    const p = Number(req.body.principal);
    if (!p || p <= 0) return res.status(400).json({ message: 'principal required' });
    principalCents = Math.round(p * 100);
  }

  const inv = await Invoice.create({
    job: job._id,
    company: job.company,
    companyEmail: job.email || '',
    principal: principalCents / 100, // keep your existing decimal if you like
    selections: req.body.selections || null
  });

  res.json(inv);
});

// List invoices (optionally by company)
router.get('/invoices', async (req,res) => {
  const filter = {};
  if (req.query.company) filter.company = req.query.company;
  const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
  const payload = invoices.map(i => ({
    ...i.toObject(),
    currentTotal: currentTotal(i)
  }));
  res.json(payload);
});

// Mark SENT (save + email). Also generates invoice PDF if missing.
router.post('/invoices/:id/send', async (req,res) => {
  const inv = await Invoice.findById(req.params.id).populate('job');
  if (!inv) return res.status(404).json({ message: 'Invoice not found' });
  if (!inv.workOrderPdfPath) {
    inv.workOrderPdfPath = await generateWorkOrderPdf(inv.job);
  }
  inv.sentAt = new Date();
  inv.status = 'SENT';
  inv.invoicePdfPath = await generateInvoicePdf(inv, inv.job);
  await inv.save();

  // email
  const toEmail = inv.billedTo?.email || inv.companyEmail;
  if (toEmail) {
    await transporter2.sendMail({
      from: 'trafficandbarriersolutions.ap@gmail.com',
      to: toEmail,
      subject: `Invoice ${inv._id} - ${inv.company}`,
      text: `Please find attached your invoice. Total due today: $${currentTotal(inv).toFixed(2)}.`,
      attachments: [
        { path: inv.invoicePdfPath },
        { path: inv.workOrderPdfPath }
      ]
    });
  }

  res.json({ message: 'Invoice sent', invId: inv._id, sentAt: inv.sentAt });
});

// Mark PAID
router.post('/invoices/:id/pay', async (req,res) => {
  const inv = await Invoice.findById(req.params.id);
  if (!inv) return res.status(404).json({ message: 'Invoice not found' });
  inv.status = 'PAID';
  inv.paidAt = new Date();
  await inv.save();
  res.json(inv);
});

// Export company invoices to Excel
router.get('/invoices/export', async (req,res) => {
  const filter = {};
  if (req.query.company) filter.company = req.query.company;
  const invoices = await Invoice.find(filter);
  const jobs = await InvoiceUser.find({ _id: { $in: invoices.map(i => i.job) } });
  const jobsById = new Map(jobs.map(j => [String(j._id), j]));

  const full = await exportInvoicesXlsx(invoices, jobsById);
  res.download(full);
});

// Download single invoice PDF
router.get('/invoices/:id/pdf', async (req,res) => {
  const inv = await Invoice.findById(req.params.id).populate('job');
  if (!inv) return res.status(404).end();
  if (!inv.invoicePdfPath) {
    inv.invoicePdfPath = await generateInvoicePdf(inv, inv.job);
    await inv.save();
  }
  res.download(inv.invoicePdfPath);
});

// Download work order PDF for a job
router.get('/workorder/:jobId/pdf', async (req,res) => {
  const job = await InvoiceUser.findById(req.params.jobId);
  if (!job) return res.status(404).end();
  const full = await generateWorkOrderPdf(job);
  res.download(full);
});

// routes/billing.js
const PriceList = require('../models/priceList');

router.get('/pricing/:companyKey', async (req,res) => {
  const doc = await PriceList.findOne({ companyKey: req.params.companyKey });
  if (!doc) return res.status(404).json({ message: 'No pricing' });
  res.json(doc); // visible only to admins via requireInvoiceAdmin
});

router.post('/bill-job', billJob);
router.post('/bill-plan', billPlan);
router.use(
    cors({
        credentials: true,
        /* origin: 'http://localhost:5173' // Make sure this matches your frontend*/
        origin: ['https://www.trafficbarriersolutions.com', 'http://localhost:5173']
    })
);
module.exports = router;

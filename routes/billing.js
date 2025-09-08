// routes/billing.js
 const express = require('express');
 const router = express.Router();
 const cors = require('cors');
 const Invoice = require('../models/invoice');
 const ControlUser = require('../models/controluser');
 const auth = require('../middleware/auth');
 const { generateWorkOrderPdf } = require('../services/workOrderPDF');
 const { generateInvoicePdf } = require('../services/invoicePDF');
 const { exportInvoicesXlsx } = require('../services/invoiceExcel');
 const { currentTotal } = require('../utils/invoiceMath');
 const transporter7 = require('../utils/emailConfig');
 const { computeTotalFromSelections } = require('../utils/pricing');
 const authJwt = require('../middleware/authJwt');
const PriceList = require('../models/priceList');

const corsOptions = {
  origin: ['http://localhost:5173','http://127.0.0.1:5173','https://www.trafficbarriersolutions.com'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};

router.use(cors(corsOptions));
router.options('*', cors(corsOptions));     // respond to preflight early

// if you prefer: short-circuit OPTIONS before auth entirely
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
router.get('/companies', async (req,res) => {
  const companies = await ControlUser.aggregate([
    { $match: { cancelled: { $ne: true } } },
    { $group: { _id: '$company' } },
    { $sort: { _id: 1 } }
  ]);
  res.json(companies.map(c => c._id).filter(Boolean));
});

// Create invoice DRAFT from job (only if not cancelled)
router.post('/invoices/from-job/:jobId', async (req,res) => {
  const job = await ControlUser.findById(req.params.jobId);
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
    await transporter7.sendMail({
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
  const jobs = await ControlUser.find({ _id: { $in: invoices.map(i => i.job) } });
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
  const job = await ControlUser.findById(req.params.jobId);
  if (!job) return res.status(404).end();
  const full = await generateWorkOrderPdf(job);
  res.download(full);
});

router.get('/pricing/:companyKey', async (req,res) => {
  const doc = await PriceList.findOne({ companyKey: req.params.companyKey });
  if (!doc) return res.status(404).json({ message: 'No pricing' });
  res.json(doc); // visible only to admins via requireInvoiceAdmin
});

 router.post('/bill-job', async (req, res) => {
   try {
     const { jobId, selections, manualAmount, emailOverride } = req.body;

     const job = await ControlUser.findById(jobId);
     if (!job) return res.status(404).json({ message: 'Job not found' });
     if (job.cancelled) return res.status(400).json({ message: 'Cancelled job cannot be billed' });
     if (job.billed) return res.status(409).json({ message: 'Job already billed' });

     // Compute principal (manual amount path requires no price list)
     let principalCents;
     if (manualAmount != null && !Number.isNaN(Number(manualAmount))) {
       principalCents = Math.round(Number(manualAmount) * 100);
     } else {
       if (!job.companyKey) return res.status(400).json({ message: 'Missing companyKey for pricing' });
       const list = await PriceList.findOne({ companyKey: job.companyKey });
       if (!list) return res.status(404).json({ message: 'No pricing for company' });
       principalCents = computeTotalFromSelections(list, selections || {});
     }

     const inv = await Invoice.create({
       job: job._id,
       company: job.company,
       companyEmail: emailOverride || job.email || '',
       principal: principalCents / 100,
       selections: selections || null,
       status: 'SENT',
       sentAt: new Date()
     });

     // Best-effort PDFs
     try {
       inv.workOrderPdfPath = await generateWorkOrderPdf(job);
       inv.invoicePdfPath = await generateInvoicePdf(inv, job);
       await inv.save();
     } catch (e) {
       console.warn('PDF generation failed (continuing):', e.message);
     }

     // Send email (from AP inbox)
     if (inv.companyEmail) {
       await transporter7.sendMail({
         from: 'trafficandbarriersolutions.ap@gmail.com',
         to: inv.companyEmail,
         subject: `Invoice ${inv._id} - ${inv.company}`,
         text: `Please find attached your invoice. Total due today: $${currentTotal(inv).toFixed(2)}.`,
         attachments: [
           inv.invoicePdfPath ? { path: inv.invoicePdfPath } : null,
           inv.workOrderPdfPath ? { path: inv.workOrderPdfPath } : null,
         ].filter(Boolean),
       });
     }

   // Flag job as billed WITHOUT triggering required validators on legacy docs
   await ControlUser.updateOne(
    { _id: job._id },
     { $set: { billed: true, billedAt: new Date(), billedInvoiceId: inv._id } },
     { runValidators: false }
  );

     res.json({ message: 'Billed', invoiceId: inv._id });
   } catch (e) {
     console.error('bill-job error', e);
     res.status(500).json({ message: 'Failed to bill job' });
   }
 });
 router.use((req, res, next) => {
  console.log('[billing router]', req.method, req.originalUrl);
  next();
});

module.exports = router;


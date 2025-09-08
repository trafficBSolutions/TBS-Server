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

// Send email (from AP inbox) but don't fail the request on mailer errors
let emailSent = false;
let emailError = null;
if (inv.companyEmail) {
  try {
    await transporter7.sendMail({
      from: 'Traffic & Barrier Solutions, LLC <trafficandbarriersolutions.ap@gmail.com>',
      to: inv.companyEmail,
      bcc: [{ name: 'Traffic & Barrier Solutions, LLC', address: process.env.INVOICE_EMAIL || 'tbsolutions3@gmail.com' }],
      subject: `Invoice ${inv._id} - ${inv.company}`,
      text: `Please find attached your invoice. Total due today: $${currentTotal(inv).toFixed(2)}.`,
      attachments: [
        inv.invoicePdfPath ? { filename: `invoice-${inv.company}.pdf`, path: inv.invoicePdfPath } : null,
        inv.workOrderPdfPath ? { filename: `work-order-${inv.company}.pdf`, path: inv.workOrderPdfPath } : null,
      ].filter(Boolean),
    });
    emailSent = true;
  } catch (err) {
    emailError = err?.message || String(err);
    console.error('bill-job sendMail failed:', emailError);
  }
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
  return res.json({
  message: emailSent ? 'Billed & emailed' : 'Billed (email failed)',
  invoiceId: inv._id,
  emailSent,
  emailError
});
 });
 router.use((req, res, next) => {
  console.log('[billing router]', req.method, req.originalUrl);
  next();
});
// routes/billing.js
// after ControlUser.updateOne(...)


router.post('/mark-paid', async (req, res) => {
  try {
    const { jobId, amount, method, last4, checkNo, receiptEmail } = req.body;

    if (!jobId || !method) return res.status(400).json({ message: 'Missing fields' });
    if (method === 'card' && !last4) return res.status(400).json({ message: 'Last4 required for card' });
    if (method === 'check' && !checkNo) return res.status(400).json({ message: 'Check # required for check' });

    const job = await ControlUser.findById(jobId); // or your Job model
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Persist payment
    const paidAt = new Date();
    job.billed = true;
    job.paid = true;
    job.paidAt = paidAt;
    job.payment = {
      method,
      last4: method === 'card' ? String(last4) : undefined,
      checkNo: method === 'check' ? String(checkNo) : undefined,
      amount: Number(amount || 0),
      recordedBy: req.user?.email || 'system',
    };
    await job.save();

    // Email receipt
    const to = receiptEmail || job.email;
    if (to) {
      const prettyAmt = (Number(amount || 0)).toFixed(2);
      await transporter7.sendMail({
        from: 'Traffic & Barrier Solutions, LLC <trafficandbarriersolutions.ap@gmail.com>',
        to,
        bcc: [{ name: 'Traffic & Barrier Solutions, LLC', address: process.env.INVOICE_EMAIL || 'tbsolutions3@gmail.com' }],
        subject: `PAYMENT RECEIPT — ${job.company}`,
        text:
`Thank you for your payment.

Company: ${job.company}
Project/Task: ${job.project || ''}
Amount: $${prettyAmt}
Method: ${method === 'card' ? `Card (•••• ${last4})` : `Check #${checkNo}`}
Paid at: ${paidAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}

Traffic & Barrier Solutions, LLC
(706) 263-0175
www.trafficbarriersolutions.com`,
        html: `
<html>
  <body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#e7e7e7;color:#000;">
    <div style="max-width:600px;margin:auto;background:#fff;padding:20px;border-radius:8px;">
      <h1 style="text-align:center;background:#efad76;padding:15px;border-radius:6px;margin-top:0;">PAYMENT RECEIPT</h1>
      <p>Thank you for your payment.</p>
      <ul>
        <li><strong>Company:</strong> ${job.company}</li>
        ${job.project ? `<li><strong>Project/Task:</strong> ${job.project}</li>` : ''}
        <li><strong>Amount:</strong> $${prettyAmt}</li>
        <li><strong>Method:</strong> ${method === 'card' ? `Card (•••• ${last4})` : `Check #${checkNo}`}</li>
        <li><strong>Paid at:</strong> ${paidAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}</li>
      </ul>
      <hr style="margin:20px 0;">
      <p style="font-size:14px;">Traffic &amp; Barrier Solutions, LLC<br>1995 Dews Pond Rd SE, Calhoun, GA 30701<br>Phone: (706) 263-0175<br><a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
    </div>
  </body>
</html>`
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to mark paid / send receipt' });
  }
});

module.exports = router;

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
const crypto = require('crypto');
const invoiceEmail = process.env.INVOICE_EMAIL || 'trafficandbarriersolutions.ap@gmail.com';
async function sendInvoiceEmail({
  job,
  cents,                      // integer cents (e.g. principalCents)
  emailOverride,
  invoicePdfPath,
  workOrderPdfPath,
  transporter7,
  invoiceEmail,
}) {
  const to = emailOverride || job?.email || '';
  if (!to) return;

  const totalUSD = (Number(cents || 0) / 100).toFixed(2);
  const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const greetingName = job?.coordinator || job?.company || 'there';

  const safeCompany = (job?.company || 'company').replace(/[^a-z0-9\- ]/gi,'');
  const atts = [
    invoicePdfPath && { filename: `invoice-${safeCompany}.pdf`, path: invoicePdfPath, contentDisposition: 'attachment' },
    workOrderPdfPath && { filename: `work-order-${safeCompany}.pdf`, path: workOrderPdfPath, contentDisposition: 'attachment' },
  ].filter(Boolean);

  await transporter7.sendMail({
    from: 'Traffic & Barrier Solutions, LLC <trafficandbarriersolutions.ap@gmail.com>',
    to,
    bcc: [
      { name: 'Traffic & Barrier Solutions, LLC', address: invoiceEmail },
      // optional more BCCs:
      // { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
      // { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
    ],
    replyTo: 'tbsolutions3@gmail.com',
    subject: `TRAFFIC CONTROL INVOICE — ${job?.company || ''} — ${today}`,
    text:
`Hi ${greetingName},

Your invoice has been created and is attached to this email.

Total due today: $${totalUSD}

A 2.5% interest has started as of the invoice date.
(An admin can clear interest by marking the invoice paid in the Admin → Invoices panel.)

Company: ${job?.company || ''}
Project/Task: ${job?.project || ''}
Address: ${[job?.address, job?.city, job?.state, job?.zip].filter(Boolean).join(', ')}

If you have any questions, please call (706) 263-0175.

Traffic & Barrier Solutions, LLC
1995 Dews Pond Rd SE, Calhoun, GA 30701
www.trafficbarriersolutions.com
`,
    html: `
<html>
  <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
    <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
      <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px; margin-top:0;">
        TRAFFIC CONTROL INVOICE
      </h1>

      <p>Hi <strong>${greetingName}</strong>,</p>
      <p>Your invoice has been created and is attached to this email.</p>

      <h3>Invoice Summary</h3>
      <ul>
        <li><strong>Total due today:</strong> $${totalUSD}</li>
        <li><strong>Invoice date:</strong> ${today}</li>
        ${job?.company ? `<li><strong>Company:</strong> ${job.company}</li>` : ''}
        ${job?.project ? `<li><strong>Project/Task:</strong> ${job.project}</li>` : ''}
        ${job?.time ? `<li><strong>Time:</strong> ${job.time}</li>` : ''}
        ${
          [job?.address, job?.city, job?.state, job?.zip].filter(Boolean).length
            ? `<li><strong>Job Site Address:</strong> ${[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}</li>`
            : ''
        }
      </ul>

      <div style="padding: 12px; background: #fff7ed; border: 1px solid #fdba74; border-radius: 6px; margin: 16px 0;">
        <strong>Interest Notice:</strong> A <strong>2.5% interest</strong> has started as of the invoice date. 
        <br/>If this invoice has been paid, the admin can clear the balance/interest in the <em>Admin → Invoices</em> panel.
      </div>

      <p style="margin-top: 16px;">
        The following documents are attached:
      </p>
      <ul>
        ${invoicePdfPath ? '<li>Invoice (PDF)</li>' : ''}
        ${workOrderPdfPath ? '<li>Work Order (PDF)</li>' : ''}
      </ul>

      <hr style="margin: 20px 0;">

      <p style="font-size: 14px;">
        Traffic &amp; Barrier Solutions, LLC<br>
        1995 Dews Pond Rd SE, Calhoun, GA 30701<br>
        Phone: (706) 263-0175<br>
        <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a>
      </p>
    </div>
  </body>
</html>
    `,
    attachments: atts,
  });
}
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
 let emailSent = false;
let emailError = null;
try {
  await sendInvoiceEmail({
    job,
    cents: principalCents,                 // integer cents
    emailOverride,
    invoicePdfPath: inv.invoicePdfPath,    // may be undefined if PDF generation failed
    workOrderPdfPath: inv.workOrderPdfPath,
    transporter7,
    invoiceEmail,
  });
  emailSent = true;
} catch (err) {
  emailError = err?.message || String(err);
  console.error('sendInvoiceEmail failed:', emailError);
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
  sentAt: new Date(),
  publicKey: crypto.randomUUID(),   // 👈 HOTFIX: ensure non-null unique value
});

     // Best-effort PDFs
     try {
       inv.workOrderPdfPath = await generateWorkOrderPdf(job);
       inv.invoicePdfPath = await generateInvoicePdf(inv, job);
       await inv.save();
     } catch (e) {
       console.warn('PDF generation failed (continuing):', e.message);
     }

let emailSent = false;
let emailError = null;
try {
  await sendInvoiceEmail({
    job,
    cents: principalCents,                 // integer cents
    emailOverride,
    invoicePdfPath: inv.invoicePdfPath,    // may be undefined if PDF generation failed
    workOrderPdfPath: inv.workOrderPdfPath,
    transporter7,
    invoiceEmail,
  });
  emailSent = true;
} catch (err) {
  emailError = err?.message || String(err);
  console.error('sendInvoiceEmail failed:', emailError);
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


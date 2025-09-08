// controllers/billControl.js
const Invoice = require('../models/invoice');
const Job = require('../models/controlinvoice');     // your job model
const Plan = require('../models/planuser');          // your plan model
const transporter2 = require('../utils/emailConfig'); // nodemailer config you already have
const { generateWorkOrderPdf } = require('../services/workOrderPDF');
const { generateInvoicePdf } = require('../services/invoicePDF');

// helper: normalize $ (frontend sends dollars as float)
function dollarsToCents(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
}

// POST /billing/bill-job
exports.billJob = async (req, res) => {
  try {
    const { jobId, manualAmount, emailOverride } = req.body;

    if (!jobId) return res.status(400).json({ message: 'jobId required' });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.cancelled) return res.status(400).json({ message: 'Cancelled job cannot be invoiced' });

    const cents = dollarsToCents(manualAmount);
    if (cents === null || cents <= 0) {
      return res.status(400).json({ message: 'manualAmount (dollars) required and must be > 0' });
    }

    // Create invoice doc (store principal as dollars to match your existing model)
    const inv = await Invoice.create({
      type: 'JOB',
      job: job._id,
      company: job.company,
      companyEmail: emailOverride || job.email || '',
      principal: cents / 100,  // keep your dollars style (consistent with routes/billing.js)
      selections: null,
      status: 'DRAFT'
    });

    // Generate PDFs
    const workOrderPdfPath = await generateWorkOrderPdf(job);
    const invoicePdfPath = await generateInvoicePdf(inv, job);

    inv.workOrderPdfPath = workOrderPdfPath;
    inv.invoicePdfPath = invoicePdfPath;
    inv.sentAt = new Date();
    inv.status = 'SENT';
    await inv.save();

    // Send email
    const to = emailOverride || job.email;
    if (to) {
      await transporter2.sendMail({
        from: 'trafficandbarriersolutions.ap@gmail.com',
        to,
        subject: `Invoice ${inv._id} - ${job.company}`,
        text: `Please find your invoice attached.\n\nTotal due today: $${(cents / 100).toFixed(2)}.`,
        attachments: [
          { path: invoicePdfPath },
          { path: workOrderPdfPath }
        ]
      });
    }

    // Mark job as billed
    job.billed = true;
    job.billedAt = new Date();
    await job.save();

    return res.json({ message: 'Invoice sent', invoiceId: inv._id, sentAt: inv.sentAt });
  } catch (err) {
    console.error('billJob error:', err);
    return res.status(500).json({ message: 'Failed to send invoice', error: err.message });
  }
};

// POST /billing/bill-plan
exports.billPlan = async (req, res) => {
  try {
    const { planId, manualAmount, emailOverride } = req.body;

    if (!planId) return res.status(400).json({ message: 'planId required' });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const cents = dollarsToCents(manualAmount);
    if (cents === null || cents <= 0) {
      return res.status(400).json({ message: 'manualAmount (dollars) required and must be > 0' });
    }

    // Reuse Invoice model; tag as PLAN
    const inv = await Invoice.create({
      type: 'PLAN',
      company: plan.company,
      companyEmail: emailOverride || plan.email || '',
      principal: cents / 100,
      selections: [{ label: 'Traffic Control Plan', qty: 1, rate: cents / 100 }],
      status: 'DRAFT',
      // optionally link the plan for traceability
      plan: plan._id
    });

    // If your generateInvoicePdf can accept (invoice, jobOrPlan), pass the plan doc.
    // Otherwise create a dedicated generatePlanInvoicePdf service and call that here.
    const invoicePdfPath = await generateInvoicePdf(inv, plan);
    inv.invoicePdfPath = invoicePdfPath;
    inv.sentAt = new Date();
    inv.status = 'SENT';
    await inv.save();

    const to = emailOverride || plan.email;
    if (to) {
      await transporter2.sendMail({
        from: 'trafficandbarriersolutions.ap@gmail.com',
        to,
        subject: `Invoice ${inv._id} - ${plan.company}`,
        text: `Please find your plan invoice attached.\n\nTotal due today: $${(cents / 100).toFixed(2)}.`,
        attachments: [{ path: invoicePdfPath }]
      });
    }

    // (Optional) mark the plan as billed if you track that on the Plan model
    if (typeof plan.billed !== 'undefined') {
      plan.billed = true;
      plan.billedAt = new Date();
      await plan.save();
    }

    return res.json({ message: 'Plan invoice sent', invoiceId: inv._id, sentAt: inv.sentAt });
  } catch (err) {
    console.error('billPlan error:', err);
    return res.status(500).json({ message: 'Failed to send plan invoice', error: err.message });
  }
};


// controllers/billControl.js
const Invoice = require('../models/invoice');
const Job = require('../models/controlinvoice');     // your job model
const Plan = require('../models/planuser');          // your plan model
const { transporter7 } = require('../utils/emailConfig'); // uses EMAIL_USER
const { generateWorkOrderPdf } = require('../services/workOrderPDF');
const { generateInvoicePdf } = require('../services/invoicePDF');
const invoiceEmail = 'trafficandbarriersolutions.ap@gmail.com'
const path = require('path');
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
async function sendInvoiceEmail({ job, cents, emailOverride, invoicePdfPath, workOrderPdfPath, transporter7, invoiceEmail }) {
  const to = emailOverride || job?.email || '';
  const totalUSD = (Number(cents || 0) / 100).toFixed(2);
  const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const greetingName = job?.coordinator || job?.company || 'there';

  if (!to) return;

  await transporter7.sendMail({
    from: 'Traffic & Barrier Solutions, LLC <trafficandbarriersolutions.ap@gmail.com>',
    to,
    // ✅ use bcc (not bbc); you can add more here, same as your request template
    bcc: [
      { name: 'Traffic & Barrier Solutions, LLC', address: invoiceEmail }
      // e.g. add more if wanted:
      // { name: 'Bryson Davis', address: 'tbsolutions3@gmail.com' },
      // { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
    ],
    replyTo: 'tbsolutions3@gmail.com',
    subject: `TRAFFIC CONTROL INVOICE — ${job?.company || ''} — ${today}`,
    // ✅ plain-text fallback helps deliverability
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
    // ✅ HTML styled to match your JOB REQUEST template
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
        <li>Invoice (PDF)</li>
        <li>Work Order (PDF)</li>
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
    attachments: [
      // Using filenames helps users; set contentDisposition 'attachment'
      { filename: `invoice-${(job?.company || 'company').replace(/[^a-z0-9\- ]/gi,'')}.pdf`, path: invoicePdfPath, contentDisposition: 'attachment' },
      { filename: `work-order-${(job?.company || 'company').replace(/[^a-z0-9\- ]/gi,'')}.pdf`, path: workOrderPdfPath, contentDisposition: 'attachment' }
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
      await transporter7.sendMail({
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




// services/interestBot.js
const Invoice = require('../models/invoice');
async function buildAttachment(inv, due) {
  const WorkOrder = require('../models/workorder');
  const { generateInvoicePdfFromInvoice } = require('../services/invoicePDF');

   let job = null;
 if (inv.job) {
   job = await WorkOrder.findById(inv.job).lean().catch(() => null);
 }
 if (!job) {
   // fallback path for older invoices that didn’t save inv.job
   job = await WorkOrder.findOne({ invoiceId: inv._id }).lean().catch(() => null);
 }
  const pdfBuffer = await generateInvoicePdfFromInvoice(inv, due, job || {});
  if (!pdfBuffer) return null;

  return {
    filename: `invoice_${inv._id}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf'
  };
}

async function sendInterestEmail(inv, due) {
  const { transporter7 } = require('../utils/emailConfig');
  const WorkOrder = require('../models/workorder');

  // Fallback if inv.companyEmail is empty
  let toEmail = inv.companyEmail;
  if (!toEmail && inv.job) {
    const job = await WorkOrder.findById(inv.job).lean().catch(() => null);
    toEmail = job?.invoiceData?.selectedEmail || job?.basic?.email || '';
  }
  if (!toEmail) {
    console.log(`[interestBot] skip ${inv._id}: no recipient email`);
    return;
  }

  // services/interestBot.js sendInterestEmail()
 const invNo =
   inv.invoiceData?.invoiceNumber || inv.invoiceNumber || String(inv._id).slice(-6);
 const subject = `INVOICE REMINDER – ${inv.company} – INV ${invNo} – $${Number(due.total || inv.computedTotalDue || 0).toFixed(2)}`;

  // Styled body similar to your billing.js email, but with the three numbers + Leah message
  const html = `
  <html>
    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
      <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
        <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">
          Invoice Reminder – ${inv.company}
        </h1>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 6px 0; font-size: 16px;"><strong>Principal:</strong> $${Number(due.principal||0).toFixed(2)}</p>
          <p style="margin: 6px 0; font-size: 16px;"><strong>Interest (2.5% simple × ${Number(due.steps||0)}):</strong> $${Number(due.interest||0).toFixed(2)}</p>
          <p style="margin: 6px 0; font-size: 16px;"><strong>Current Total:</strong> $${Number(due.total||0).toFixed(2)}</p>
        </div>

        <p style="text-align:center; font-size:16px; margin: 24px 0;">
          Please call <strong>Leah Davis</strong> for payment: <strong>(706) 913-3317</strong>
        </p>

        <div style="text-align: center; border-top: 2px solid #efad76; padding-top: 15px; margin-top: 30px;">
          <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
          <p style="margin: 5px 0;">1999 Dews Pond Rd SE, Calhoun, GA 30701</p>
          <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
        </div>
      </div>
    </body>
  </html>`;

  const text =
`Invoice Reminder – ${inv.company}
Principal: $${Number(due.principal||0).toFixed(2)}
Interest (2.5% simple × ${Number(due.steps||0)}): $${Number(due.interest||0).toFixed(2)}
Current Total: $${Number(due.total||0).toFixed(2)}

Please call Leah Davis for payment: (706) 913-3317`;

  const attachment = await buildAttachment(inv, due).catch(() => null);

await transporter7.sendMail({
    from: 'trafficandbarriersolutions.ap@gmail.com',
    to: toEmail,                         // ✅ use the resolved email
    subject,
    text,
    html,
    attachments: attachment ? [attachment] : []
  });
}

// services/interestBot.js
async function runInterestReminderCycle(now = new Date(), opts = {}) {
  const force = !!opts.force;
  const { currentTotal } = require('../utils/invoiceMath');
  const WorkOrder = require('../models/workorder');
  const MS = 24*60*60*1000;
  const GRACE_DAYS = 21; // adjust if needed

  const invoices = await Invoice.find({ status: { $in: ['SENT', 'PARTIALLY_PAID'] } });

  let checked = 0, emailed = 0, skippedNoEmail = 0, skippedNoStep = 0;

  for (const inv of invoices) {
    checked++;

    // 1) Resolve baseDate from invoice or job
    let baseDate = inv.dueDate ? new Date(inv.dueDate) : null;

    if (!baseDate && inv.job) {
      const job = await WorkOrder.findById(inv.job).lean().catch(() => null);
      const dueStr = job?.invoiceData?.dueDate; // "YYYY-MM-DD"
      if (dueStr) baseDate = new Date(`${dueStr}T00:00:00Z`);
    }

    // 2) Fallback: sentAt + grace
    if (!baseDate && inv.sentAt) {
      baseDate = new Date(new Date(inv.sentAt).getTime() + GRACE_DAYS * MS);
    }

    // 3) Still nothing? Skip.
    if (!baseDate) {
      console.log(`[interestBot] skip ${inv._id}: no due date/sentAt`);
      skippedNoStep++;
      continue;
    }

    // 4) Step math (first day AFTER due date = step 1)
    const daysPast = Math.floor((now - baseDate) / MS);
    const stepsByDue = daysPast >= 1 ? Math.floor((daysPast - 1) / 14) + 1 : 0;

    // 5) Central math
    const principal = Number(inv.principal || 0);
    const rate = Number(inv.interestRate || 0.025);
    const due = {
      steps: stepsByDue,
      interest: principal * rate * stepsByDue,
      total: principal + (principal * rate * stepsByDue),
      principal: principal
    };
    // after computing `daysPast` and `stepsByDue`
console.log(
  `[interestBot] inv=${inv._id} company=${inv.company} baseDate=${baseDate?.toISOString?.() || 'n/a'} daysPast=${daysPast} steps=${stepsByDue} prev=${inv.interestStepsEmailed||0}`
);

    // 6) Don’t re-email prior steps
    const prev = Number(inv.interestStepsEmailed || 0);
    const cur  = Number(due.steps || 0);
    if (!force && (cur <= prev || cur <= 0)) {
  console.log(`[interestBot] skip (no step) inv=${inv._id} cur=${cur} prev=${prev}`);
  skippedNoStep++;
  continue;
}

    // 7) Resolve recipient
    let toEmail = inv.companyEmail;
    if (!toEmail && inv.job) {
      const job = await WorkOrder.findById(inv.job).lean().catch(() => null);
      toEmail = job?.invoiceData?.selectedEmail || job?.basic?.email || '';
    }
    if (!toEmail) { skippedNoEmail++; continue; }

    // 8) Persist computed totals
    await Invoice.updateOne(
      { _id: inv._id },
      { $set: {
          accruedInterest: Number(due.interest.toFixed(2)),
          computedTotalDue: Number(due.total.toFixed(2)),
          lastComputedAt: now
        }}
    );

    // 9) Send + record
    await sendInterestEmail(inv, due);
    emailed++;
    await Invoice.updateOne(
      { _id: inv._id },
      {
        $set: { interestStepsEmailed: cur, lastReminderAt: now },
        $push: { history: { at: now, action: `INTEREST_EMAIL_STEP_${cur}`, by: 'bot' } }
      }
    );
  }

  console.log(`[interestBot] checked=${checked} emailed=${emailed} noStep=${skippedNoStep} noEmail=${skippedNoEmail}`);
}

module.exports = { runInterestReminderCycle };

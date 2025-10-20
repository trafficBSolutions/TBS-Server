// services/interestBot.js
const Invoice = require('../models/invoice');
async function buildAttachment(inv) {
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
  let pdfBuffer;
  pdfBuffer = await generateInvoicePdfFromInvoice(inv, job || {});

  return {
    filename: `invoice_${inv._id}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf'
  };
}

async function sendInterestEmail(inv) {
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
  inv.invoiceNumber ||
  inv.invoiceData?.invoiceNumber ||
  // final fallback: try the job’s saved invoice snapshot
  (inv.jobInvoiceNumber /* set below if you like */) ||
  String(inv._id).slice(-6);
  const isOverdue = !!inv.dueDate && (new Date() > new Date(inv.dueDate));
  const reminderType = isOverdue ? 'OVERDUE NOTICE' : 'PAYMENT REMINDER';
  const amount = Number(
    inv.invoiceData?.sheetTotal ??
    inv.principal ??
    0
  );
  const subject = `${reminderType} – ${inv.company} – INV ${invNo} – $${amount.toFixed(2)}`;

  // Styled body similar to your billing.js email, but with the three numbers + Leah message
  const html = `
  <html>
    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
      <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
        <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">
          Invoice Reminder – ${inv.company}
        </h1>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 6px 0; font-size: 16px;"><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
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
Amount Due: $${amount.toFixed(2)}

Please call Leah Davis for payment: (706) 913-3317`;

  const attachment = await buildAttachment(inv).catch(err => {
    console.error(`[sendInterestEmail] buildAttachment failed for ${inv._id}:`, err);
    return null;
  });
  
  console.log(`[sendInterestEmail] Attachment status for ${inv._id}: ${attachment ? 'SUCCESS' : 'FAILED'}`);

  const mailOptions = {
    from: 'trafficandbarriersolutions.ap@gmail.com',
    to: toEmail,
    subject,
    text,
    html,
    attachments: attachment ? [attachment] : []
  };
  
  console.log(`[sendInterestEmail] Sending email to ${toEmail} with ${attachment ? 'PDF attachment' : 'NO attachment'}`);
  await transporter7.sendMail(mailOptions);
  console.log(`[sendInterestEmail] Email sent successfully to ${toEmail}`);
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

    // 4) Pre-due and post-due logic
    const daysPast = Math.floor((now - baseDate) / MS);
    const stepsByDue = daysPast >= 1 ? Math.floor((daysPast - 1) / 14) + 1 : 0;
    
    // Pre-due reminders: -7, -3, -1 days before due date
    const isPreDue = daysPast < 0;
    const daysUntilDue = Math.abs(daysPast);
    let reminderStep = 0;
    
    if (isPreDue) {
      if (daysUntilDue <= 1) reminderStep = -1;
      else if (daysUntilDue <= 3) reminderStep = -2;
      else if (daysUntilDue <= 7) reminderStep = -3;
    } else {
      reminderStep = stepsByDue;
    }

    // 5) Pure reminder cadence (no interest math)
    const principal = Number(
      inv.principal ??
      inv.invoiceData?.sheetTotal ??
      0
    );
    const prevReminders = inv.remindersSent || [];
    const shouldSend = isPreDue
      ? (reminderStep !== 0 && !prevReminders.includes(reminderStep))
      : (reminderStep > 0 && !prevReminders.includes(reminderStep));
    
    if (!force && !shouldSend) {
      console.log(`[interestBot] skip (no reminder) inv=${inv._id} step=${reminderStep}`);
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


        // 8) Send + record (no interest)
    await sendInterestEmail(inv);
    emailed++;
    await Invoice.updateOne(
      { _id: inv._id },
      {
        $addToSet: { remindersSent: reminderStep },
        $set: { lastReminderAt: now },
        $push: { history: { at: now, action: (isPreDue ? `PRE_DUE_REMINDER_${Math.abs(reminderStep)}` : `POST_DUE_REMINDER_${reminderStep}`), by: 'bot' } }
      }
    );
  }

  console.log(`[interestBot] checked=${checked} emailed=${emailed} noStep=${skippedNoStep} noEmail=${skippedNoEmail}`);
}

module.exports = { runInterestReminderCycle };

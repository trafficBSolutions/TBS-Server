// services/interestBot.js
const Invoice = require('../models/invoice');
const ControlUser = require('../models/controluser');
const { currentTotal } = require('../utils/invoiceMath');
const { generateInvoicePdf } = require('../services/invoicePDF'); // must export a function that returns Buffer or file path
const { transporter7 } = require('../utils/emailConfig');

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.trafficbarriersolutions.com';

async function buildAttachment(inv) {
  try {
    // If your generator needs extra info, load it here.
    // Some apps store job/client details on a separate doc; if not, feel free to remove this.
    const job = inv.job ? await ControlUser.findById(inv.job).lean() : null;

    // Be tolerant: generator may return a Buffer or a file path (string)
    const pdfResult = await generateInvoicePdf(inv, null, job);

    if (!pdfResult) return null;

    if (Buffer.isBuffer(pdfResult)) {
      return {
        filename: `invoice_${inv._id}.pdf`,
        content: pdfResult,
        contentType: 'application/pdf'
      };
    }
    if (typeof pdfResult === 'string') {
      return {
        filename: `invoice_${inv._id}.pdf`,
        path: pdfResult,
        contentType: 'application/pdf'
      };
    }
    return null;
  } catch (e) {
    console.error('[interestBot] PDF generation failed for', inv._id, e.message);
    return null;
  }
}

async function sendInterestEmail(inv, due) {
  const subject = `Invoice ${inv._id}: Updated balance $${Number(due.total || 0).toFixed(2)}`;
  const text = [
    `Hello,`,
    ``,
    `This is a friendly reminder regarding your outstanding invoice.`,
    ``,
    `Principal: $${Number(due.principal || 0).toFixed(2)}`,
    `Interest steps at 2.5% (simple): ${Number(due.steps || 0)}`,
    `Interest due: $${Number(due.interest || 0).toFixed(2)}`,
    `Current total: $${Number(due.total || 0).toFixed(2)}`,
    ``,
    `Pay by card: ${BASE_URL}/pay/${inv.publicKey || ''}`,
    `Prefer to mail a check? Click “I’ll mail a check” on that page so we know it’s on the way.`,
    ``,
    `Note: Interest is a flat 2.5% of the original principal beginning 21 days after the invoice was sent, and every 14 days thereafter.`,
    ``,
    `Thank you,`,
    `Traffic & Barrier Solutions, LLC`
  ].join('\n');

  const attachment = await buildAttachment(inv);

  await transporter7.sendMail({
    from: 'trafficandbarriersolutions.ap@gmail.com',
    to: inv.companyEmail,                     // ensure this is populated when invoice is created
    subject,
    text,
    attachments: attachment ? [attachment] : []
  });
}

async function runInterestReminderCycle(now = new Date()) {
  // Only unpaid invoices—paid ones should be PAID and won’t match this query
  const invoices = await Invoice.find({
    status: { $in: ['SENT', 'PARTIALLY_PAID'] }
  });

  for (const inv of invoices) {
    try {
      const due = currentTotal(inv, now);

      // Only email when the step count increased since last time
      const prev = Number(inv.interestStepsEmailed || 0);
      const cur  = Number(due.steps || 0);
      const canEmail = cur > prev && inv.companyEmail; // need an email address

      if (!canEmail) continue;

      await sendInterestEmail(inv, due);

      // Make sure history exists
      const historyEntry = { at: now, action: `INTEREST_EMAIL_STEP_${cur}`, by: 'bot' };

      // Update atomically
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: { interestStepsEmailed: cur, lastReminderAt: now },
          $push: { history: historyEntry }
        }
      );
    } catch (e) {
      console.error('[interestBot] error on', inv._id, e.message);
    }
  }
}

module.exports = { runInterestReminderCycle };

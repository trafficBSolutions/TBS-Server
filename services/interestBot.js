// services/interestBot.js
const Invoice = require('../models/invoice');
const ControlUser = require('../models/controluser');
const { currentTotal } = require('../utils/invoiceMath');
const { generateInvoicePdf } = require('../services/invoicePdf'); // <-- use the Invoice PDF maker
const { transporter7 } = require('../utils/emailConfig');

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.trafficbarriersolutions.com';

async function sendInterestEmail(inv, due) {
  // fetch the job/control user if you want job info in the PDF
  const job = inv.job ? await ControlUser.findById(inv.job).lean() : {};

  // make sure a new PDF is generated for **today’s** total (principal + stepped interest)
  const pdfPath = await generateInvoicePdf(inv, /* manualAmount not used by this generator */ null, job);

  const subject = `Invoice ${inv._id}: Updated balance $${due.total.toFixed(2)}`;
  const text = [
    `Hello,`,
    ``,
    `This is a friendly reminder regarding your outstanding invoice.`,
    ``,
    `Principal: $${due.principal?.toFixed(2)}`,
    `Interest steps at 2.5% (simple): ${due.steps}`,
    `Interest due: $${due.interest?.toFixed(2)}`,
    `Current total: $${due.total?.toFixed(2)}`,
    ``,
    `Pay by card: ${BASE_URL}/pay/${inv.publicKey}`,
    `Prefer to mail a check? Click “I’ll mail a check” on that page so we know it’s on the way.`,
    ``,
    `Note: Interest is a flat 2.5% of the original principal beginning 21 days after the invoice was sent, and every 14 days thereafter.`,
    ``,
    `Thank you,`,
    `Traffic & Barrier Solutions, LLC`
  ].join('\n');

  await transporter7.sendMail({
    from: 'trafficandbarriersolutions.ap@gmail.com',
    to: inv.companyEmail,
    subject,
    text,
    attachments: pdfPath ? [{
      filename: `invoice_${inv._id}.pdf`,
      path: pdfPath,
      contentType: 'application/pdf'
    }] : []
  });
}

async function runInterestReminderCycle(now = new Date()) {
  const list = await Invoice.find({ status: { $in: ['SENT','PARTIALLY_PAID'] } });

  for (const inv of list) {
    const due = currentTotal(inv, now);

    // Only email on days where the step count increased
    if (due.steps > (inv.interestStepsEmailed || 0)) {
      try {
        await sendInterestEmail(inv, due);
        inv.interestStepsEmailed = due.steps;
        inv.lastReminderAt = now;
        inv.history.push({ at: now, action:`INTEREST_EMAIL_STEP_${due.steps}`, by:'bot' });
        await inv.save();
      } catch (e) {
        console.error('interestBot email error', inv._id, e.message);
      }
    }
  }
}

module.exports = { runInterestReminderCycle };

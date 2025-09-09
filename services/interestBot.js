// services/interestBot.js
const Invoice = require('../models/invoice');
const { currentTotal } = require('../utils/invoiceMath');
const transporter2 = require('../utils/emailConfig');

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.trafficbarriersolutions.com';

async function sendInterestEmail(inv, due) {
  const subject = `Invoice ${inv._id}: Updated balance $${due.total.toFixed(2)}`;
  const text = [
    `Hello,`,
    ``,
    `This is a friendly reminder regarding your outstanding invoice.`,
    ``,
    `Principal: $${due.principal.toFixed(2)}`,
    `Interest steps at 2.5% (simple): ${due.steps}`,
    `Interest due: $${due.interest.toFixed(2)}`,
    `Current total: $${due.total.toFixed(2)}`,
    ``,
    `Pay by card: ${BASE_URL}/pay/${inv.publicKey}`,
    `Prefer to mail a check? Click “I’ll mail a check” on that page so we know it’s on the way.`,
    ``,
    `Note: Interest is a flat 2.5% of the original principal beginning 21 days after the invoice was sent, and every 14 days thereafter.`,
    ``,
    `Thank you,`,
    `Traffic & Barrier Solutions, LLC`
  ].join('\n');

  await transporter2.sendMail({
    from: 'trafficandbarriersolutions.ap@gmail.com',
    to: inv.companyEmail,
    subject,
    text
  });
}

async function runInterestReminderCycle(now = new Date()) {
  // SENT but not PAID
  const list = await Invoice.find({ status: 'SENT' });

  for (const inv of list) {
    const due = currentTotal(inv, now);

    // Only email on the days where the step count increased
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

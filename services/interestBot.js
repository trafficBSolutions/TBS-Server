// services/interestBot.js
const Invoice = require('../models/invoice');
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.trafficbarriersolutions.com';

async function buildAttachment(inv) {
  // lazy require breaks cycles with invoicePDF/controluser
  const ControlUser = require('../models/controluser');
  const { generateInvoicePdf } = require('../services/invoicePDF');

  const job = inv.job ? await ControlUser.findById(inv.job).lean() : null;
  const pdfResult = await generateInvoicePdf(inv, null, job || {});
  if (!pdfResult) return null;

  return Buffer.isBuffer(pdfResult)
    ? { filename: `invoice_${inv._id}.pdf`, content: pdfResult, contentType: 'application/pdf' }
    : typeof pdfResult === 'string'
    ? { filename: `invoice_${inv._id}.pdf`, path: pdfResult, contentType: 'application/pdf' }
    : null;
}

async function sendInterestEmail(inv, due) {
  // lazy require for the mailer
  const { transporter7 } = require('../utils/emailConfig');

  const subject = `Invoice ${inv._id}: Updated balance $${Number(due.total || 0).toFixed(2)}`;
  const payUrl = `${BASE_URL}/pay/${inv.publicKey || ''}`;

  const text = `Hello,

This is a friendly reminder regarding your outstanding invoice.

Principal: $${Number(due.principal||0).toFixed(2)}
Interest steps at 2.5% (simple): ${Number(due.steps||0)}
Interest due: $${Number(due.interest||0).toFixed(2)}
Current total: $${Number(due.total||0).toFixed(2)}

Pay by card: ${payUrl}
Prefer to mail a check? Click “I’ll mail a check” on that page so we know it’s on the way.

Note: Interest is a flat 2.5% of the original principal beginning 21 days after the invoice was sent, and every 14 days thereafter.

Thank you,
Traffic & Barrier Solutions, LLC`;

  const html = `
    <p>Hello,</p>
    <p>This is a friendly reminder regarding your outstanding invoice.</p>
    <ul>
      <li>Principal: $${Number(due.principal||0).toFixed(2)}</li>
      <li>Interest steps at 2.5% (simple): ${Number(due.steps||0)}</li>
      <li>Interest due: $${Number(due.interest||0).toFixed(2)}</li>
      <li><b>Current total: $${Number(due.total||0).toFixed(2)}</b></li>
    </ul>
    <p>Pay by card: <a href="${payUrl}">${payUrl}</a></p>
    <p>Prefer to mail a check? Click “I’ll mail a check” on that page so we know it’s on the way.</p>
    <p><small>Note: Interest is a flat 2.5% of the original principal beginning 21 days after the invoice was sent, and every 14 days thereafter.</small></p>
    <p>Thank you,<br/>Traffic & Barrier Solutions, LLC</p>
  `;

  const attachment = await buildAttachment(inv).catch(() => null);

  await transporter7.sendMail({
    from: 'trafficandbarriersolutions.ap@gmail.com',
    to: inv.companyEmail,
    subject,
    text,
    html,
    attachments: attachment ? [attachment] : []
  });
}

// unchanged
async function runInterestReminderCycle(now = new Date()) {
  const { currentTotal } = require('../utils/invoiceMath'); // lazy too, just in case

  const invoices = await Invoice.find({ status: { $in: ['SENT', 'PARTIALLY_PAID'] } });
  for (const inv of invoices) {
    const due = currentTotal(inv, now);
    const prev = Number(inv.interestStepsEmailed || 0);
    const cur  = Number(due.steps || 0);
    if (cur > prev && inv.companyEmail) {
      await sendInterestEmail(inv, due);
      await Invoice.updateOne(
        { _id: inv._id },
        {
          $set: { interestStepsEmailed: cur, lastReminderAt: now },
          $push: { history: { at: now, action: `INTEREST_EMAIL_STEP_${cur}`, by: 'bot' } }
        }
      );
    }
  }
}

// existing exports
module.exports = { runInterestReminderCycle };

// --- CLI runner (only runs if you `node services/interestBot.js`) ---
if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');

  (async () => {
    const MONGO = process.env.MONGO_URL;
    if (!MONGO) {
      console.error('❌ MONGO_URL missing in .env');
      process.exit(1);
    }

    try {
      await mongoose.connect(MONGO);
      console.log('[interestBot] Connected. Running interest reminder cycle…');
      await runInterestReminderCycle(new Date());
      console.log('✅ Done.');
    } catch (err) {
      console.error('❌ Error running interest cycle:', err);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
      // Give any pending logs/telemetry a beat to flush
      setTimeout(() => process.exit(), 50);
    }
  })();
}


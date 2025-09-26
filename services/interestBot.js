// services/interestBot.js
const Invoice = require('../models/invoice');

async function buildAttachment(inv, due) {
  const ControlUser = require('../models/controluser');
  const { generateInvoicePdfFromInvoice } = require('../services/invoicePDF');

  const job = inv.job ? await ControlUser.findById(inv.job).lean() : null;
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

  const subject = `INVOICE REMINDER – ${inv.company} – $${Number(due.total || 0).toFixed(2)}`;

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
    to: inv.companyEmail,
    subject,
    text,
    html,
    attachments: attachment ? [attachment] : []
  });
}

async function runInterestReminderCycle(now = new Date()) {
  const { currentTotal } = require('../utils/invoiceMath');

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

module.exports = { runInterestReminderCycle };

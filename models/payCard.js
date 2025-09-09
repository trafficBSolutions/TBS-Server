// routes/publicInvoice.js
const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const { currentTotal } = require('../utils/invoiceMath');
const transporter2 = require('../utils/emailConfig');

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.trafficbarriersolutions.com';

// 1) Get invoice info by public key (no auth)
router.get('/public/invoice/:key', async (req,res) => {
  const inv = await Invoice.findOne({ publicKey: req.params.key });
  if (!inv || inv.status === 'VOID') return res.status(404).json({ message:'Not found' });

  const due = currentTotal(inv);
  res.json({
    company: inv.company,
    principal: inv.principal,
    interestRate: inv.interestRate,
    sentAt: inv.sentAt,
    status: inv.status,
    steps: due.steps,
    interest: due.interest,
    total: due.total
  });
});

// 2) Customer says "I'm mailing a check"
router.post('/public/invoice/:key/ack-check', async (req,res) => {
  const inv = await Invoice.findOne({ publicKey: req.params.key });
  if (!inv || inv.status !== 'SENT') return res.status(404).json({ message:'Not found' });

  inv.paymentMethod = 'CHECK';
  inv.checkPromisedAt = new Date();
  inv.history.push({ at:new Date(), action:'CUSTOMER_PROMISED_CHECK', by:'public' });
  await inv.save();

  // (Optional) notify AP mailbox
  try {
    await transporter2.sendMail({
      from: 'trafficandbarriersolutions.ap@gmail.com',
      to: 'trafficandbarriersolutions.ap@gmail.com',
      subject: `Invoice ${inv._id}: customer chose CHECK`,
      text: `Customer indicated they're mailing a check.\n\nCompany: ${inv.company}\nTotal Due (today): $${currentTotal(inv).total.toFixed(2)}\n\nInvoice link: ${BASE_URL}/pay/${inv.publicKey}`
    });
  } catch {}
  res.json({ ok:true });
});

module.exports = router;

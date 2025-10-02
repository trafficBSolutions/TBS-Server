// routes/publicInvoice.js
const express = require('express');
const router = express.Router();
const Invoice = require('../models/invoice');
const { currentTotal } = require('../utils/invoiceMath');
const { transporter7 }= require('../utils/emailConfig');

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
    await transporter7.sendMail({
      from: 'trafficandbarriersolutions.ap@gmail.com',
      to: 'trafficandbarriersolutions.ap@gmail.com',
      subject: `Invoice ${inv._id}: customer chose CHECK`,
      text: `Customer indicated they're mailing a check.\n\nCompany: ${inv.company}\nTotal Due (today): $${currentTotal(inv).total.toFixed(2)}\n\nInvoice link: ${BASE_URL}/pay/${inv.publicKey}`
    });
  } catch {}
  res.json({ ok:true });
});

// 3) Admin marks check as received
router.post('/admin/invoice/:id/check-received', async (req, res) => {
  try {
    const { checkNumber, receivedDate, amount } = req.body;
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    inv.checkReceivedAt = receivedDate ? new Date(receivedDate) : new Date();
    inv.status = amount >= inv.principal ? 'PAID' : 'PARTIALLY_PAID';
    inv.paidAt = inv.status === 'PAID' ? inv.checkReceivedAt : undefined;
    inv.history.push({ 
      at: new Date(), 
      action: `CHECK_RECEIVED_${checkNumber}`, 
      by: 'admin',
      amount: amount
    });
    await inv.save();

    // Update related work order
    if (inv.job) {
      await WorkOrder.updateOne(
        { _id: inv.job },
        {
          $set: {
            paid: inv.status === 'PAID',
            paymentMethod: `Check #${checkNumber}`,
            paidAt: inv.paidAt,
            checkNumber: checkNumber,
            lastPaymentAmount: amount,
            lastPaymentAt: inv.checkReceivedAt,
            currentAmount: Math.max(0, inv.principal - amount)
          }
        }
      );
    }

    res.json({ message: 'Check receipt recorded', invoice: inv });
  } catch (error) {
    console.error('Check received error:', error);
    res.status(500).json({ message: 'Failed to record check receipt' });
  }
});

module.exports = router;

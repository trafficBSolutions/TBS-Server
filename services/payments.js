// services/payments.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Invoice = require('../models/invoice');
const WorkOrder = require('../models/workorder');

// Create a PaymentIntent for a work order (card or ACH)
router.post('/create-payment-intent', async (req, res) => {
  const { workOrderId, amountCents, method = 'card' } = req.body;
  // amountCents comes from your authoritative total (currentAmount * 100)
  const wo = await WorkOrder.findById(workOrderId);
  if (!wo) return res.status(404).json({ message: 'Work order not found' });

  const payment_method_types = method === 'ach' ? ['us_bank_account'] : ['card'];

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    payment_method_types,
    capture_method: 'automatic',
    metadata: {
      workOrderId: String(wo._id),
      invoiceId: wo.invoiceId ? String(wo.invoiceId) : '',
      client: wo.basic?.client || '',
      project: wo.basic?.project || ''
    }
  });

  res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
});

// Simple card payment processing (for manual card entry)
router.post('/process-card-payment', async (req, res) => {
  try {
    const { workOrderId, cardNumber, expMonth, expYear, cvc, amountCents } = req.body;
    
    const wo = await WorkOrder.findById(workOrderId);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });

    // Create payment method
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardNumber,
        exp_month: expMonth,
        exp_year: expYear,
        cvc: cvc,
      },
    });

    // Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method: paymentMethod.id,
      confirm: true,
      metadata: {
        workOrderId: String(wo._id),
        invoiceId: wo.invoiceId ? String(wo.invoiceId) : '',
        client: wo.basic?.client || '',
        project: wo.basic?.project || ''
      }
    });

    res.json({ 
      success: true, 
      paymentIntent: paymentIntent,
      cardLast4: paymentMethod.card.last4,
      cardBrand: paymentMethod.card.brand
    });
  } catch (error) {
    console.error('Card payment error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Webhook: mark paid/partial on success
router.post('/webhooks/stripe', express.raw({type:'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = require('stripe').webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const workOrderId = pi.metadata?.workOrderId;
    const paidCents = pi.amount_received || pi.amount; // usually equal on success

    if (workOrderId) {
      const wo = await WorkOrder.findById(workOrderId);
      if (wo) {
        // compute remaining after this charge
        const totalCents =
          Math.round((wo.currentAmount ?? wo.billedAmount ?? wo.invoiceTotal ?? 0) * 100);
        const remainingCents = Math.max(0, totalCents - paidCents);

        await WorkOrder.updateOne(
          { _id: wo._id },
          {
            $set: {
              paid: remainingCents === 0,
              currentAmount: remainingCents / 100,
              lastPaymentAmount: paidCents / 100,
              lastPaymentAt: new Date(),
              paymentMethod: pi.payment_method_types?.[0] === 'us_bank_account' ? 'ACH' : 'CARD'
            }
          }
        );

        if (wo.invoiceId) {
          await Invoice.updateOne(
            { _id: wo.invoiceId },
            {
              $set: {
                status: remainingCents === 0 ? 'PAID' : 'PARTIALLY_PAID',
                paidAt: remainingCents === 0 ? new Date() : undefined,
                paymentMethod: pi.payment_method_types?.[0] === 'us_bank_account' ? 'ACH' : 'CARD'
              }
            }
          );
        }

        // (Optional) email a receipt using your existing code
        // (You already have generateReceiptPdf + email utils)
      }
    }
  }

  // You can also handle .payment_intent.payment_failed, .processing, etc.
  res.json({ received: true });
});

module.exports = router;

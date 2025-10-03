// routes/billing.js
 const express = require('express');
 const router = express.Router();
 const cors = require('cors');
 const mongoose = require('mongoose');
 const Invoice = require('../models/invoice');
 const ControlUser = require('../models/controluser');
 const auth = require('../middleware/auth');
const requireInvoiceAdmin = require('../middleware/requireInvoiceAdmin');
 const { generateInvoicePdfFromWorkOrder } = require('../services/invoicePDF');
const { loadStdAssets } = require('../services/v42Base'); // add this
const { printHtmlToPdfBuffer } = require('../services/invoicePDF'); // optional: reuse the shared printer
const fs = require('fs');
const path = require('path');
const WorkOrder = require('../models/workorder');
const { runInterestReminderCycle } = require('../services/interestBot');
// Set the due date to a past date
router.post('/test/backdate-due', async (req, res) => {
  try {
    const { workOrderId, days = 15 } = req.body || {};
    if (!workOrderId) return res.status(400).json({ message: 'workOrderId required' });

    const wo = await WorkOrder.findById(workOrderId);
    if (!wo) return res.status(404).json({ message: 'Work order not found' });

    const pastDueDate = new Date();
    pastDueDate.setDate(pastDueDate.getDate() - Number(days));

    await WorkOrder.updateOne(
      { _id: workOrderId },
      { $set: { 'invoiceData.dueDate': pastDueDate.toISOString().slice(0, 10), paid: false } }
    );
 await Invoice.updateOne(
   { job: workOrderId },
   { $set: { dueDate: pastDueDate } }
 );
    res.json({ ok: true, workOrderId, dueDate: pastDueDate.toISOString().slice(0,10) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Run the interest bot once (with optional "now")
router.post('/test/run-interest-once', async (req, res) => {
  try {
    const { nowISO, force = false } = req.body || {};
    const now = nowISO ? new Date(nowISO) : new Date();
    await runInterestReminderCycle(now, { force });
    res.json({ ok: true, ranAt: now.toISOString() });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const os = require('os');

async function generateReceiptPdf(workOrder, paymentDetails, paymentAmount, totalOwedAmount = null) {
  const { logo } = loadStdAssets();
  const formatCurrency = (amount) => `$${Number(amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  
  const paidAmount = Number(paymentAmount) || 0;
  // Use manually entered totalOwed if provided, otherwise fall back to stored values
  const totalOwed = totalOwedAmount || workOrder.invoiceData?.sheetTotal || workOrder.invoiceTotal || workOrder.invoicePrincipal || workOrder.currentAmount || workOrder.billedAmount || 0;
  // Clamp payment to not exceed what's owed, and remaining balance to never go negative
  const actualPaid = Math.min(paidAmount, totalOwed);
  const remainingBalance = Math.max(0, totalOwed - actualPaid);
  
  // Get invoice data for detailed receipt
  const invoiceData = workOrder.invoiceData || {};
  const sheetRows = invoiceData.sheetRows || [];
  const billableRows = sheetRows.filter(r => Number(r?.amount) > 0);
  const lateFees = Number(workOrder.lateFees || 0);
  const accruedInterest = Number(workOrder._invoice?.accruedInterest || 0);
  const interestAmount = Math.max(lateFees, accruedInterest);
  
  // Services section HTML
  const servicesHtml = billableRows.length > 0 ? `
    <div style="margin: 20px 0;">
      <h3 style="color: var(--tbs-navy); border-bottom: 2px solid var(--tbs-navy); padding-bottom: 5px;">SERVICES PROVIDED</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Service</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${billableRows.map(row => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.service}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(row.amount)}</td>
            </tr>
          `).join('')}
          ${interestAmount > 0 ? `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; color: #d32f2f;"><strong>Late Payment Interest</strong></td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #d32f2f;"><strong>${formatCurrency(interestAmount)}</strong></td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    </div>
  ` : '';
  
  // Bill To section HTML
  const billToCompany = invoiceData.billToCompany || workOrder.basic?.client;
  const billToAddress = invoiceData.billToAddress;
  const billToHtml = billToCompany ? `
    <div style="margin: 20px 0;">
      <h3 style="color: var(--tbs-navy); border-bottom: 2px solid var(--tbs-navy); padding-bottom: 5px;">BILLED TO</h3>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 6px;">
        <div><strong>${billToCompany}</strong></div>
        ${billToAddress ? `<div>${billToAddress}</div>` : ''}
      </div>
    </div>
  ` : '';
  
  // Job Details section HTML
  const jobDetailsHtml = `
    <div style="margin: 20px 0;">
      <h3 style="color: var(--tbs-navy); border-bottom: 2px solid var(--tbs-navy); padding-bottom: 5px;">JOB DETAILS</h3>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 6px;">
        <div><strong>Work Type:</strong> ${invoiceData.workType || 'Traffic Control'}</div>
        <div><strong>Foreman:</strong> ${invoiceData.foreman || workOrder.basic?.foremanName || ''}</div>
        <div><strong>Location:</strong> ${invoiceData.location || [workOrder.basic?.address, workOrder.basic?.city, workOrder.basic?.state, workOrder.basic?.zip].filter(Boolean).join(', ')}</div>
        <div><strong>Date of Service:</strong> ${workOrder.basic?.dateOfJob || new Date(workOrder.createdAt).toLocaleDateString()}</div>
        ${invoiceData.invoiceNumber ? `<div><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</div>` : ''}
        ${invoiceData.dueDate ? `<div><strong>Due Date:</strong> ${new Date(invoiceData.dueDate).toLocaleDateString()}</div>` : ''}
      </div>
    </div>
  `;
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root { --tbs-navy: #17365D; --tbs-blue: #2F5597; }
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; }
    body { font-family: Arial, Helvetica, sans-serif; color:#111; padding: 20px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; }
    .header .brand { display:flex; gap:12px; align-items:center; }
    .header .brand img { height:60px; }
    .header .brand .company { font-weight:700; font-size:12px; line-height:1.1; }
    .title { text-align:center; letter-spacing:1px; font-weight:700; font-size:26px; color:var(--tbs-blue); margin-bottom: 20px; }
    .receipt-box { border: 2px solid var(--tbs-navy); padding: 20px; border-radius: 8px; background: #f9f9f9; }
    .receipt-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #ddd; }
    .receipt-row.total { font-weight:700; border-top:2px solid var(--tbs-navy); border-bottom:none; font-size:18px; }
    .footer { margin-top:30px; text-align:center; font-size:12px; color:#666; }
    @page { size: A4; margin: 18mm; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${logo}" alt="TBS Logo" />
      <div class="company">
        <div style="font-size:14px; font-weight:bold;">TBS</div>
        <div>Traffic and Barrier Solutions, LLC</div>
        <div>1999 Dews Pond Rd SE</div>
        <div>Calhoun, GA 30701</div>
        <div>Cell: 706-263-0175</div>
        <div>Email: tbsolutions3@gmail.com</div>
      </div>
    </div>
  </div>
  
  <h1 class="title">PAYMENT RECEIPT</h1>
  
  ${billToHtml}
  ${jobDetailsHtml}
  ${servicesHtml}
  
  <div class="receipt-box">
    <div class="receipt-row">
      <span>Client:</span>
      <span><strong>${workOrder.basic?.client}</strong></span>
    </div>
    <div class="receipt-row">
      <span>Project:</span>
      <span>${workOrder.basic?.project}</span>
    </div>
    <div class="receipt-row">
      <span>Payment Date:</span>
      <span>${new Date().toLocaleDateString()}</span>
    </div>
    <div class="receipt-row">
      <span>Payment Method:</span>
      <span>${paymentDetails}</span>
    </div>
    <div class="receipt-row">
      <span>Original Invoice Total:</span>
      <span>${formatCurrency(totalOwed - interestAmount)}</span>
    </div>
    ${interestAmount > 0 ? `
    <div class="receipt-row" style="color: #d32f2f;">
      <span>Late Payment Interest:</span>
      <span>${formatCurrency(interestAmount)}</span>
    </div>
    ` : ''}
    <div class="receipt-row">
      <span>Total Amount Due:</span>
      <span>${formatCurrency(totalOwed)}</span>
    </div>
    <div class="receipt-row total">
      <span>AMOUNT PAID:</span>
      <span>${formatCurrency(actualPaid)}</span>
    </div>
    <div class="receipt-row">
      <span>Remaining Balance:</span>
      <span>${formatCurrency(remainingBalance)}</span>
    </div>
  </div>
  
  <div class="footer">
    <p><strong>Thank you for your payment!</strong></p>
    <p>This receipt confirms payment has been received.</p>
    ${remainingBalance === 0 ? '<p><strong>Account Paid in Full</strong></p>' : `<p>Remaining balance of ${formatCurrency(remainingBalance)} is still due.</p>`}
  </div>
</body>
</html>`;

  try {
    const pdfBuffer = await printHtmlToPdfBuffer(html);
    console.log('[receipt] PDF generated, size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
  } catch (e) {
    console.error('[receipt] PDF generation failed:', e);
    return null;
    }
}
 const { exportInvoicesXlsx } = require('../services/invoiceExcel');
 const { currentTotal } = require('../utils/invoiceMath');
 const { transporter7 } = require('../utils/emailConfig');
 const { computeTotalFromSelections } = require('../utils/pricing');
 const authJwt = require('../middleware/authJwt');
const PriceList = require('../models/priceList');

const corsOptions = {
  origin: ['https://www.trafficbarriersolutions.com'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};
router.use(cors(corsOptions));
router.options('*', cors(corsOptions));

router.use((req, res, next) => {
  console.log('[billing router]', req.method, req.originalUrl, req.path);
  next();
});

// Mark invoice as paid
router.post('/mark-paid', async (req, res) => {
  try {
    const { 
      workOrderId, 
      paymentMethod, 
      emailOverride, 
      cardLast4, 
      cardType, 
      checkNumber, 
      paymentAmount, 
      totalOwed,
      // New Stripe fields
      stripePaymentIntentId,
      cardNumber,
      expMonth,
      expYear,
      cvc,
      processStripe = false
    } = req.body;
    const WorkOrder = require('../models/workorder');

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });
    if (workOrder.paid) return res.status(409).json({ message: 'Work order already paid' });
    
    // Always fetch Invoice data for authoritative amount if available
   // --- NEW: load invoice (prefer id, fallback to job) so we can use accrued interest ---
  let invoiceDoc = null;
   if (workOrder.invoiceId) {
     invoiceDoc = await Invoice.findById(workOrder.invoiceId).lean().catch(() => null);
   }
   if (!invoiceDoc) {
     invoiceDoc = await Invoice.findOne({ job: workOrder._id }).lean().catch(() => null);   
    }
       const invPrincipal = Number(invoiceDoc?.principal ?? 0);
   const invAccrued   = Number(invoiceDoc?.accruedInterest ?? 0);
   const invComputed  = Number(invoiceDoc?.computedTotalDue ?? 0); // principal + accrued
    const enteredTotalOwed = Number(totalOwed ?? 0);
    const requestedPaid    = Number(paymentAmount ?? 0);
   // Priorities:
   // 1) user-entered override
   // 2) invoice.computedTotalDue (bot output)
   // 3) invoice.principal + invoice.accruedInterest
   // 4) old fallbacks
   const fallbackLegacy =
     Number(
       workOrder.invoiceData?.sheetTotal ??
       workOrder.invoiceTotal ??
       workOrder.invoicePrincipal ??
       workOrder.currentAmount ??
       workOrder.billedAmount ??
       0
     );
   const totalOwedFinal = enteredTotalOwed > 0
     ? enteredTotalOwed
     : (invComputed > 0
         ? invComputed
         : ((invPrincipal + invAccrued) || fallbackLegacy));
    const actualPaid       = Math.max(0, Math.min(requestedPaid, totalOwedFinal));
    const remainingBalance = Math.max(0, totalOwedFinal - actualPaid);
    const isPaidInFull     = remainingBalance === 0;
    
    // Process Stripe payment if requested
   // inside POST /mark-paid (replace the "processStripe && cardNumber" block)
let stripeResult = null;

if (stripePaymentIntentId) {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId, { expand: ['charges.data.payment_method_details'] });

    if (pi.status !== 'succeeded') {
      return res.status(400).json({ message: `PaymentIntent not succeeded (status: ${pi.status})` });
    }

    // extract brand/last4
    const ch = pi.charges?.data?.[0];
    const pmd = ch?.payment_method_details;
    const card = pmd?.card;

    stripeResult = {
      success: true,
      paymentIntentId: pi.id,
      amount: pi.amount / 100,
      cardLast4: card?.last4,
      cardBrand: card?.brand
    };

    // override paymentAmount with what Stripe actually charged, for safety
    req.body.paymentAmount = stripeResult.amount;
  } catch (stripeError) {
    console.error('Stripe verify error:', stripeError);
    return res.status(400).json({ message: 'Unable to verify Stripe payment', error: stripeError.message });
  }
}

// later, when you build `paymentDetails`:
if (paymentMethod === 'card') {
  if (stripeResult) {
    paymentDetails = `${(stripeResult.cardBrand || '').toUpperCase()} ****${stripeResult.cardLast4 || ''}`;
  } else if (cardLast4 && cardType) {
    paymentDetails = `${cardType} ****${cardLast4}`;
  }
}

    
    // Update work order with payment info
    await WorkOrder.updateOne(
      { _id: workOrder._id },
      { $set: { 
        paid: isPaidInFull, 
        paymentMethod: paymentDetails,
        paidAt: isPaidInFull ? new Date() : undefined,
        cardLast4: cardLast4 || undefined,
        cardType: cardType || undefined,
        checkNumber: checkNumber || undefined,
           // reflect the currently due total & show interest as "lateFees"
        lateFees: Number(invAccrued.toFixed(2)),
        billedAmount: totalOwedFinal, 
        currentAmount: remainingBalance,
        lastPaymentAmount: actualPaid,
        lastPaymentAt: new Date(),
        lastManualTotalOwed: totalOwedFinal,
        interestDisabled: isPaidInFull ? true : undefined
      } },
      { runValidators: false }
    );

    // Update Invoice record if it exists
    console.log('[mark-paid] WorkOrder invoiceId:', workOrder.invoiceId, 'isPaidInFull:', isPaidInFull);
    if (workOrder.invoiceId) {
      const invoiceUpdateResult = await Invoice.updateOne(
        { _id: workOrder.invoiceId },
        { $set: {
          status: isPaidInFull ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: isPaidInFull ? new Date() : undefined,
         paymentMethod: paymentMethod === 'card' ? 'CARD' : 'CHECK',
               principal: totalOwedFinal,
               accruedInterest: Number(invAccrued.toFixed(2)),
               computedTotalDue: Number(totalOwedFinal.toFixed(2)),
        }}
      );
      console.log('[mark-paid] Invoice update result:', invoiceUpdateResult);
    } else {
      console.log('[mark-paid] No invoiceId found on WorkOrder - trying to find Invoice by job field');
      // Fallback: try to find Invoice by job field (WorkOrder._id)
      try {
        const invoiceUpdateResult = await Invoice.updateOne(
          { job: workOrder._id },
          { $set: {
            status: isPaidInFull ? 'PAID' : 'PARTIALLY_PAID',
            paidAt: isPaidInFull ? new Date() : undefined,
           paymentMethod: paymentMethod === 'card' ? 'CARD' : 'CHECK',
            principal: totalOwedFinal
          }}
        );
        console.log('[mark-paid] Invoice update by job field result:', invoiceUpdateResult);
        if (invoiceUpdateResult.matchedCount === 0) {
          console.log('[mark-paid] No Invoice found for WorkOrder:', workOrder._id);
        }
      } catch (err) {
        console.error('[mark-paid] Failed to update Invoice by job field:', err);
      }
    }

    // Send receipt email
    if (emailOverride) {
      const receiptHtml = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #28a745; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">Payment Receipt - ${workOrder.basic?.client}</h1>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; font-size: 16px;"><strong>Total Owed:</strong> $${totalOwedFinal.toFixed(2)}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Payment Received:</strong> $${actualPaid.toFixed(2)}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Remaining Balance:</strong> $${remainingBalance.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${paymentDetails}</p>
                <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${workOrder.basic?.project}</p>
              </div>
              
              <p style="text-align: center; font-size: 16px; margin: 30px 0;">Thank you for your payment!</p>
              
              <div style="text-align: center; border-top: 2px solid #28a745; padding-top: 15px; margin-top: 30px;">
                <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
                <p style="margin: 5px 0;">1999 Dews Pond Rd SE, Calhoun, GA 30701</p>
                <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: 'trafficandbarriersolutions.ap@gmail.com',
        to: emailOverride,
         subject: `PAYMENT RECEIPT – ${workOrder.basic?.client} – Paid $${actualPaid.toFixed(2)} (Owed $${totalOwedFinal.toFixed(2)})`,
        html: receiptHtml
      };

      try {
const receiptPdfBuffer = await generateReceiptPdf(
          workOrder,
          paymentDetails,
          actualPaid,
          totalOwedFinal
        );
        
        if (receiptPdfBuffer) {
          mailOptions.attachments = [{
            filename: `receipt-${(workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
            content: receiptPdfBuffer,
            contentType: 'application/pdf'
          }];
        }
        
        await transporter7.sendMail(mailOptions);
        console.log('[receipt] email sent to:', emailOverride);
      } catch (emailError) {
        console.error('Receipt email failed:', emailError);
      }
    }

    res.json({ message: 'Payment recorded successfully', workOrderId: workOrder._id });
  } catch (e) {
    console.error('Mark paid error:', e);
    res.status(500).json({ message: 'Failed to record payment', error: e.message });
  }
});

// Test endpoint to create overdue invoice for testing
router.post('/create-test-overdue', async (req, res) => {
  try {
    const WorkOrder = require('../models/workorder');
    const { workOrderId } = req.body;
    
    if (!workOrderId) {
      return res.status(400).json({ message: 'workOrderId required' });
    }
    
    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder || !workOrder.billed) {
      return res.status(404).json({ message: 'Billed work order not found' });
    }
    
    // Set due date to 15 days ago for testing
    const pastDueDate = new Date();
    pastDueDate.setDate(pastDueDate.getDate() - 15);
    
    await WorkOrder.updateOne(
      { _id: workOrder._id },
      { 
        $set: { 
          'invoiceData.dueDate': pastDueDate.toISOString().slice(0, 10),
          paid: false,
          lateFees: 0
        }
      }
    );
    
    res.json({ message: 'Test overdue invoice created', dueDate: pastDueDate.toISOString().slice(0, 10) });
  } catch (e) {
    console.error('Create test overdue error:', e);
    res.status(500).json({ message: 'Failed to create test overdue', error: e.message });
  }
});

// Late fee processor (run this as a cron job)
router.post('/process-late-fees', async (req, res) => {
  try {
    const WorkOrder = require('../models/workorder');
    const now = new Date();
    
    // Find all billed but unpaid work orders
    const unpaidInvoices = await WorkOrder.find({
  billed: true,
  paid: { $ne: true },
  billedAt: { $exists: true }
});


    let processed = 0;
    let emailsSent = 0;
    
    for (const workOrder of unpaidInvoices) {
      // Skip if no due date in invoice data
      if (!workOrder.invoiceData?.dueDate) continue;
      
      const dueDate = new Date(workOrder.invoiceData.dueDate);
      const daysPastDue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      if (daysPastDue > 0) {
        // Calculate late fees (every 14 days past due)
        const lateFeeIntervals = Math.floor(daysPastDue / 14);
        const lateFeeAmount = lateFeeIntervals * 25; // $25 per 14-day period
        
        if (lateFeeAmount > (workOrder.lateFees || 0)) {
          const newLateFees = lateFeeAmount;
          const newTotal = (workOrder.billedAmount || 0) + newLateFees;
          
          await WorkOrder.updateOne(
            { _id: workOrder._id },
            { 
              $set: { 
                lateFees: newLateFees,
                currentAmount: newTotal,
                lastLateFeeUpdate: now
              }
            }
          );
          processed++;
          
          // Send late fee notification email with updated PDF
          const clientEmail = workOrder.invoiceData?.selectedEmail || workOrder.basic?.email;
          if (clientEmail) {
            try {
              // Generate updated PDF with late fees
              const updatedInvoiceData = {
                ...workOrder.invoiceData,
                sheetOther: newLateFees,
                sheetTotal: newTotal
              };
              
              const pdfBuffer = await generateInvoicePdfFromWorkOrder(workOrder, newTotal, updatedInvoiceData);
              
              const emailHtml = `
                <html>
                  <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
                    <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
                      <h1 style="text-align: center; background-color: #dc3545; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">LATE FEE NOTICE - ${workOrder.basic?.client}</h1>
                      
                      <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #f5c6cb;">
                        <p style="margin: 5px 0; font-size: 16px;"><strong>Late Fee Applied:</strong> $${newLateFees.toFixed(2)}</p>
                        <p style="margin: 5px 0;"><strong>Days Past Due:</strong> ${daysPastDue}</p>
                        <p style="margin: 5px 0;"><strong>New Total Amount:</strong> $${newTotal.toFixed(2)}</p>
                        <p style="margin: 5px 0;"><strong>Original Due Date:</strong> ${new Date(workOrder.invoiceData.dueDate).toLocaleDateString()}</p>
                      </div>
                      
                      <p style="text-align: center; font-size: 16px; margin: 30px 0;">Your invoice is past due. A late fee of $25.00 per 14-day period has been applied. Please remit payment immediately to avoid additional fees.</p>
                      
                      <div style="text-align: center; border-top: 2px solid #dc3545; padding-top: 15px; margin-top: 30px;">
                        <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
                        <p style="margin: 5px 0;">1999 Dews Pond Rd SE, Calhoun, GA 30701</p>
                        <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
                      </div>
                    </div>
                  </body>
                </html>
              `;
              const mailOptions = {
                from: 'trafficandbarriersolutions.ap@gmail.com',
                to: clientEmail,
                subject: `LATE FEE NOTICE – ${workOrder.basic?.client} – $${newTotal.toFixed(2)}`,
                html: emailHtml,
                attachments: pdfBuffer ? [{
                  filename: `late-fee-invoice-${(workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf'
                }] : []
              };
              
              await transporter7.sendMail(mailOptions);
              emailsSent++;
              console.log(`[late-fee] Email sent to ${clientEmail} for work order ${workOrder._id}`);
            } catch (emailError) {
              console.error(`[late-fee] Failed to send email for work order ${workOrder._id}:`, emailError);
            }
          }
        }
      }
    }

    res.json({ 
      message: `Processed late fees for ${processed} invoices, sent ${emailsSent} notifications`,
      processed,
      emailsSent
    });
  } catch (e) {
    console.error('Late fee processing error:', e);
    res.status(500).json({ message: 'Failed to process late fees', error: e.message });
  }
});

// Update existing invoice
router.post('/update-invoice', async (req, res) => {
  try {
    const { workOrderId, manualAmount, emailOverride, invoiceData } = req.body;
    const WorkOrder = require('../models/workorder');

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });
    if (!workOrder.billed) return res.status(400).json({ message: 'Work order not yet billed' });

    const finalInvoiceTotal = invoiceData.sheetTotal || manualAmount;
    
    // Update existing Invoice record
    const updateData = {
      principal: finalInvoiceTotal,
      invoiceData,
      invoiceNumber: invoiceData?.invoiceNumber,
      workRequestNumber1: invoiceData?.workRequestNumber1,
      workRequestNumber2: invoiceData?.workRequestNumber2,
      lineItems: (invoiceData.sheetRows || []).map(row => ({
        description: row.service,
        qty: 1,
        unitPrice: row.amount,
        total: row.amount
      })),
      billedTo: {
        name: invoiceData.billToCompany || workOrder.basic?.client,
        email: emailOverride
      }
    };

    // Update by invoiceId first, fallback to job field
    let invoiceUpdateResult;
    if (workOrder.invoiceId) {
      invoiceUpdateResult = await Invoice.updateOne({ _id: workOrder.invoiceId }, { $set: updateData });
    } else {
      invoiceUpdateResult = await Invoice.updateOne({ job: workOrder._id }, { $set: updateData });
    }

    // Update work order with new invoice data
    await WorkOrder.updateOne(
      { _id: workOrder._id },
      { $set: { 
        billedAmount: finalInvoiceTotal,
        currentAmount: finalInvoiceTotal,
        invoiceTotal: finalInvoiceTotal,
        invoiceData: invoiceData
      } },
      { runValidators: false }
    );

    // Send updated invoice email
    if (emailOverride) {
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateInvoicePdfFromWorkOrder(workOrder, finalInvoiceTotal, invoiceData);
      } catch (e) {
        console.error('[update-invoice] PDF generation failed:', e);
      }

      const emailHtml = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #17365D; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">UPDATED Invoice - ${workOrder.basic?.client}</h1>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; font-size: 16px;"><strong>Updated Invoice Amount:</strong> $${Number(finalInvoiceTotal).toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Work Order Date:</strong> ${workOrder.basic?.dateOfJob}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${workOrder.basic?.project}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'Same as original'}</p>
              </div>
              
              <p style="text-align: center; font-size: 16px; margin: 30px 0;">This is an updated version of your invoice. Please find the revised invoice PDF attached.</p>
              
              <div style="text-align: center; border-top: 2px solid #17365D; padding-top: 15px; margin-top: 30px;">
                <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
                <p style="margin: 5px 0;">1995 Dews Pond Rd SE, Calhoun, GA 30701</p>
                <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: 'trafficandbarriersolutions.ap@gmail.com',
        to: emailOverride,
        subject: `UPDATED INVOICE – ${workOrder.basic?.client} – $${Number(finalInvoiceTotal).toFixed(2)}`,
        html: emailHtml,
        attachments: []
      };

      if (pdfBuffer && pdfBuffer.length > 0) {
        const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');
        mailOptions.attachments.push({
          filename: `updated-invoice-${safeClient}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
      }

      try {
        await transporter7.sendMail(mailOptions);
        console.log('[update-invoice] email sent to:', emailOverride);
      } catch (emailError) {
        console.error('Updated invoice email failed:', emailError);
      }
    }

    const updated = await WorkOrder.findById(workOrder._id).lean();
    res.json({ message: 'Invoice updated successfully', workOrder: updated });
  } catch (e) {
    console.error('Update invoice error:', e);
    res.status(500).json({ message: 'Failed to update invoice', error: e.message });
  }
});

router.post('/bill-workorder', async (req, res) => {
  console.log('*** BILLING ROUTER - BILL WORKORDER HIT ***');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { workOrderId, manualAmount, emailOverride, invoiceData } = req.body;
    const WorkOrder = require('../models/workorder');

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });
    if (workOrder.billed) return res.status(409).json({ message: 'Work order already billed' });

    // Calculate the final invoice total
    const finalInvoiceTotal = invoiceData.sheetTotal || manualAmount;
    
    // Create Invoice record
    const invoice = new Invoice({
      job: workOrder._id && mongoose.Types.ObjectId.isValid(workOrder._id) ? workOrder._id : null,
      company: workOrder.basic?.client,
      companyEmail: emailOverride,
      principal: finalInvoiceTotal,
      status: 'SENT',
      sentAt: new Date(),
      dueDate: invoiceData?.dueDate ? new Date(invoiceData.dueDate) : undefined, // <-- add
         invoiceData,                                     // <-- persist the full snapshot
   invoiceNumber: invoiceData?.invoiceNumber ||     // <-- persist a stable invoice #
                  String(workOrder?._id || '').slice(-6),
   workRequestNumber1: invoiceData?.workRequestNumber1,
   workRequestNumber2: invoiceData?.workRequestNumber2,
      lineItems: (invoiceData.sheetRows || []).map(row => ({
        description: row.service,
        qty: 1,
        unitPrice: row.amount,
        total: row.amount
      })),
      billedTo: {
        name: invoiceData.billToCompany || workOrder.basic?.client,
        email: emailOverride
      }
    });
    await invoice.save();
    
    // Mark work order as billed
    await WorkOrder.updateOne(
      { _id: workOrder._id },
      { $set: { 
        billed: true, 
        billedAt: new Date(), 
        billedAmount: finalInvoiceTotal,
        currentAmount: finalInvoiceTotal,
        invoiceTotal: finalInvoiceTotal,
        invoiceData: invoiceData,
        invoiceId: invoice._id,
        lateFees: 0
      } },
      { runValidators: false }
    );

    // Generate PDF and send invoice email
    console.log('Email override value:', emailOverride);
    if (emailOverride) {
      console.log('Attempting to send email to:', emailOverride);
      
      // Generate invoice PDF
      let pdfBuffer = null;
      try {
  console.log('[invoice] starting PDF generation…');
  pdfBuffer = await generateInvoicePdfFromWorkOrder(workOrder, finalInvoiceTotal, invoiceData);
  console.log('[invoice] PDF buffer size:', pdfBuffer?.length || 0);
} catch (e) {
  console.error('[invoice] PDF generation failed:', e?.stack || e);
}

      const emailHtml = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">Invoice - ${workOrder.basic?.client}</h1>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; font-size: 16px;"><strong>Invoice Amount:</strong> $${Number(finalInvoiceTotal).toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Work Order Date:</strong> ${workOrder.basic?.dateOfJob}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${workOrder.basic?.project}</p>
                <p style="margin: 5px 0;"><strong>Address:</strong> ${workOrder.basic?.address}, ${workOrder.basic?.city}, ${workOrder.basic?.state} ${workOrder.basic?.zip}</p>
              </div>
              
              <p style="text-align: center; font-size: 16px; margin: 30px 0;">Please find the attached invoice PDF. Thank you for your business!</p>
              
              <div style="text-align: center; border-top: 2px solid #efad76; padding-top: 15px; margin-top: 30px;">
                <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
                <p style="margin: 5px 0;">1995 Dews Pond Rd SE, Calhoun, GA 30701</p>
                <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
              </div>
            </div>
          </body>
        </html>
      `;
const mailOptions = {
  from: 'trafficandbarriersolutions.ap@gmail.com',
  to: emailOverride,
  subject: `INVOICE – ${workOrder.basic?.client} – $${Number(finalInvoiceTotal).toFixed(2)}`,
  html: emailHtml,
  attachments: []
};
if (pdfBuffer && pdfBuffer.length > 0) {
  const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');
  mailOptions.attachments.push({
    filename: `invoice-${safeClient}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf'
  });
} else {
  // Fallback so “attached: true” is still true with a readable artifact
  console.error('[invoice] PDF generation failed - no attachment will be sent');
}
      try {
        const info = await transporter7.sendMail(mailOptions);
console.log('[invoice] email sent', {
  to: emailOverride,
  messageId: info.messageId,
  attached: !!mailOptions.attachments.length,
  attachmentTypes: mailOptions.attachments.map(a => a.contentType)
});
      
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    } else {
      console.log('No email override provided, skipping email');
    }

    console.log('Work order marked as billed successfully');
     const updated = await WorkOrder.findById(workOrder._id).lean();
 res.json({ message: 'Work order billed successfully', workOrder: updated });
  } catch (e) {
    console.error('Bill work order error:', e);
    res.status(500).json({ message: 'Failed to bill work order', error: e.message });
  }
});
// Get invoice status for one or more work orders
router.get('/invoice-status', async (req, res) => {
  try {
    const idsParam = (req.query.workOrderIds || '').trim();
    if (!idsParam) return res.json({ byWorkOrder: {} });

    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

    const invoices = await Invoice.find({ job: { $in: objectIds } })
      .select('_id job principal status paidAt sentAt publicKey accruedInterest computedTotalDue interestStepsEmailed')
      .lean();

    // Normalize into a dictionary by workOrderId
    const byWorkOrder = {};
    for (const inv of invoices) {
      byWorkOrder[String(inv.job)] = {
        invoiceId: String(inv._id),
        status: inv.status,                // DRAFT | SENT | PARTIALLY_PAID | PAID | VOID
        principal: Number(inv.principal) || 0,
         accruedInterest: Number(inv.accruedInterest) || 0,
 computedTotalDue: Number(inv.computedTotalDue) || 0,
 interestStepsEmailed: Number(inv.interestStepsEmailed) || 0,
        sentAt: inv.sentAt || null,
        paidAt: inv.paidAt || null,
        publicKey: inv.publicKey || null
      };
    }
    res.json({ byWorkOrder });
  } catch (e) {
    console.error('[GET /billing/invoice-status] error:', e);
    res.status(500).json({ message: 'Failed to load invoice status' });
  }
});
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { workOrderId, paymentAmount } = req.body;
    const WorkOrder = require('../models/workorder');
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const wo = await WorkOrder.findById(workOrderId).lean();
    if (!wo) return res.status(404).json({ message: 'Work order not found' });

    // Reuse your authoritative total logic:
    let invoiceDoc = null;
    if (wo.invoiceId) invoiceDoc = await Invoice.findById(wo.invoiceId).lean().catch(()=>null);
    if (!invoiceDoc) invoiceDoc = await Invoice.findOne({ job: wo._id }).lean().catch(()=>null);

    const invPrincipal = Number(invoiceDoc?.principal ?? 0);
    const invAccrued   = Number(invoiceDoc?.accruedInterest ?? 0);
    const invComputed  = Number(invoiceDoc?.computedTotalDue ?? 0);

    const fallbackLegacy = Number(
      wo.invoiceData?.sheetTotal ?? wo.invoiceTotal ?? wo.invoicePrincipal ?? wo.currentAmount ?? wo.billedAmount ?? 0
    );

    const totalOwedFinal = (invComputed > 0 ? invComputed : (invPrincipal + invAccrued) || fallbackLegacy);
    const requestedPaid  = Number(paymentAmount ?? 0);
    const actualPaid     = Math.max(0, Math.min(requestedPaid, totalOwedFinal));

    if (actualPaid <= 0) return res.status(400).json({ message: 'Payment amount must be > 0' });

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(actualPaid * 100),
      currency: 'usd',
      // use the modern Payment Element:
      automatic_payment_methods: { enabled: true },
      metadata: {
        workOrderId: String(wo._id),
        invoiceId: wo.invoiceId ? String(wo.invoiceId) : '',
        client: wo.basic?.client || '',
        project: wo.basic?.project || ''
      }
    });

    return res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, amount: actualPaid });
  } catch (e) {
    console.error('[create-payment-intent] error:', e);
    res.status(500).json({ message: 'Failed to create PaymentIntent' });
  }
});
module.exports = router;

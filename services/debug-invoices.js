// services/debug-invoices.js
require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/invoice');
const WorkOrder = require('../models/workorder');

const MONGO = process.env.MONGO_URL;

(async () => {
  await mongoose.connect(MONGO);
  
  const now = new Date();
  const MS = 24*60*60*1000;
  const GRACE_DAYS = 21;
  
  console.log(`\n=== INVOICE DEBUG - ${now.toISOString()} ===\n`);
  
  const invoices = await Invoice.find({ 
    status: { $in: ['SENT', 'PARTIALLY_PAID'] } 
  }).lean();
  
  console.log(`Found ${invoices.length} invoices with status SENT/PARTIALLY_PAID\n`);
  
  for (const inv of invoices) {
    console.log(`--- Invoice ${inv._id} ---`);
    console.log(`Company: ${inv.company}`);
    console.log(`Status: ${inv.status}`);
    console.log(`Principal: $${inv.principal || 0}`);
    console.log(`CompanyEmail: ${inv.companyEmail || 'NONE'}`);
    console.log(`SentAt: ${inv.sentAt ? new Date(inv.sentAt).toISOString() : 'NONE'}`);
    console.log(`DueDate: ${inv.dueDate ? new Date(inv.dueDate).toISOString() : 'NONE'}`);
    console.log(`InterestStepsEmailed: ${inv.interestStepsEmailed || 0}`);
    console.log(`AccruedInterest: $${inv.accruedInterest || 0}`);
    console.log(`ComputedTotalDue: $${inv.computedTotalDue || 0}`);
    
    // Calculate what the bot would do
    let baseDate = inv.dueDate ? new Date(inv.dueDate) : null;
    
    if (!baseDate && inv.job) {
      const job = await WorkOrder.findById(inv.job).lean().catch(() => null);
      const dueStr = job?.invoiceData?.dueDate;
      if (dueStr) baseDate = new Date(`${dueStr}T00:00:00Z`);
      console.log(`Job DueDate: ${dueStr || 'NONE'}`);
    }
    
    if (!baseDate && inv.sentAt) {
      baseDate = new Date(new Date(inv.sentAt).getTime() + GRACE_DAYS * MS);
      console.log(`Calculated BaseDate (sentAt + ${GRACE_DAYS} days): ${baseDate.toISOString()}`);
    }
    
    if (baseDate) {
      const daysPast = Math.floor((now - baseDate) / MS);
      const stepsByDue = daysPast >= 1 ? Math.floor((daysPast - 1) / 14) + 1 : 0;
      const prev = Number(inv.interestStepsEmailed || 0);
      
      console.log(`BaseDate: ${baseDate.toISOString()}`);
      console.log(`DaysPast: ${daysPast}`);
      console.log(`StepsByDue: ${stepsByDue}`);
      console.log(`Previous Steps Emailed: ${prev}`);
      console.log(`Would Email: ${stepsByDue > prev && stepsByDue > 0 ? 'YES' : 'NO'}`);
      
      if (stepsByDue > 0) {
        const principal = Number(inv.principal || 0);
        const rate = 0.025;
        const interest = principal * rate * stepsByDue;
        const total = principal + interest;
        console.log(`Interest Calculation: $${principal} × 2.5% × ${stepsByDue} = $${interest.toFixed(2)}`);
        console.log(`Total Due: $${total.toFixed(2)}`);
      }
    } else {
      console.log(`NO BASE DATE - Would Skip`);
    }
    
    console.log('');
  }
  
  await mongoose.disconnect();
  console.log('=== DEBUG COMPLETE ===');
})();

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
const { generateReceiptPdf } = require('../services/receiptPDF');
const fs = require('fs');
const path = require('path');
const WorkOrder = require('../models/workorder');
const { runInterestReminderCycle } = require('../services/interestBot');
const PlanUser = require('../models/planuser');
async function getPreviousTotal(workOrderId) {
  const WorkOrder = require('../models/workorder');
  const Invoice = require('../models/invoice');

  if (!mongoose.isValidObjectId(workOrderId)) return 0;

  const workOrder = await WorkOrder.findById(workOrderId)
    .select('billedAmount currentAmount invoiceTotal invoiceData invoiceId')
    .lean()
    .catch(() => null);

  if (!workOrder) return 0;

  // Try to find linked invoice
  let invoice = null;
  if (workOrder.invoiceId) {
    invoice = await Invoice.findById(workOrder.invoiceId)
      .select('principal computedTotalDue accruedInterest')
      .lean()
      .catch(() => null);
  }
  if (!invoice) {
    invoice = await Invoice.findOne({ job: workOrder._id })
      .select('principal computedTotalDue accruedInterest')
      .lean()
      .catch(() => null);
  }

  // Compute a best-guess previous total
  const previousTotal =
    Number(invoice?.computedTotalDue) ||
    (Number(invoice?.principal || 0) + Number(invoice?.accruedInterest || 0)) ||
    Number(workOrder.invoiceData?.sheetTotal || 0) ||
    Number(workOrder.invoiceTotal || 0) ||
    Number(workOrder.billedAmount || 0) ||
    Number(workOrder.currentAmount || 0);

  return previousTotal;
}

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
// === Email threading + PDF helpers ===
async function findInvoiceForWorkOrder(wo) {
  if (!wo) return null;
  // 1) If the WO points at an invoice, use it
  if (wo.invoiceId) {
    const inv = await Invoice.findById(wo.invoiceId).lean().catch(() => null);
    if (inv) return inv;
  }
  // 2) Otherwise pick the *latest* invoice for this job
  const [latest] = await Invoice.find({ job: wo._id })
    .sort({ sentAt: -1, updatedAt: -1, createdAt: -1 })
   .limit(1)
    .lean()
    .catch(() => [null]);
  return latest || null;
}

// Convert 24-hour time to 12-hour format
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes}${ampm}`;
}
function threadHeaders(invoiceDoc) {
  const headers = {};
  if (invoiceDoc?.emailMessageId) {
    const messageId = invoiceDoc.emailMessageId.startsWith('<') ? invoiceDoc.emailMessageId : `<${invoiceDoc.emailMessageId}>`;
    headers['In-Reply-To'] = messageId;
    headers['References'] = messageId;
  }
  return headers;
}

// Generate comprehensive plan details HTML with enhanced CSS styling
function generatePlanDetailsHtml(plan, invoiceData = {}) {
  const completedDate = new Date(plan.createdAt || Date.now());
  
  // Full address formatting
  const fullAddress = [plan.address, plan.city, plan.state, plan.zip]
    .filter(Boolean).join(', ');
  
  // Due date formatting
  const dueDate = invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A';
  
  return `
    <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f2ff 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid #007bff; box-shadow: 0 4px 12px rgba(0,123,255,0.15); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="background: #007bff; color: white; padding: 12px 16px; border-radius: 8px; margin: -20px -20px 20px -20px; box-shadow: 0 2px 8px rgba(0,123,255,0.3);">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">📋 Traffic Control Plan Invoice</h2>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Invoice Date: ${completedDate.toLocaleDateString()}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #17a2b8; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h4 style="margin: 0 0 12px 0; color: #17a2b8; font-size: 16px; border-bottom: 2px solid #17a2b8; padding-bottom: 4px;">📋 Plan Details</h4>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Project:</strong> <span style="color: #007bff; font-weight: 600;">${plan.project || 'N/A'}</span></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Coordinator:</strong> ${plan.name || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Company:</strong> ${plan.company || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${plan.email || 'N/A'}</p>
          ${plan.phone ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Phone:</strong> ${plan.phone}</p>` : ''}
        </div>
        
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #28a745; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h4 style="margin: 0 0 12px 0; color: #28a745; font-size: 16px; border-bottom: 2px solid #28a745; padding-bottom: 4px;">📍 Job Site Location</h4>
          <p style="margin: 4px 0; font-size: 14px; line-height: 1.4;"><strong>Address:</strong><br/><span style="color: #495057; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 2px;">${fullAddress || 'N/A'}</span></p>
          <p style="margin: 8px 0 4px 0; font-size: 14px;"><strong>Due Date:</strong> <span style="color: #dc3545; font-weight: 600;">${dueDate}</span></p>
        </div>
      </div>
      
      ${plan.message ? `<div style="margin: 16px 0; padding: 16px; background: #f8f9fa; border-left: 4px solid #6c757d; border-radius: 0 8px 8px 0;"><strong style="color: #495057; font-size: 14px;">📝 Additional Notes:</strong><p style="margin: 8px 0 0 0; color: #495057; line-height: 1.4; font-style: italic;">${plan.message}</p></div>` : ''}
    </div>
  `;
}

// Generate comprehensive work order details HTML with enhanced CSS styling
function generateWorkOrderDetailsHtml(workOrder) {
  const startTime = formatTime12Hour(workOrder.basic?.startTime);
  const endTime = formatTime12Hour(workOrder.basic?.endTime);
  const completedDate = new Date(workOrder.createdAt);
  
  // Full address formatting
  const fullAddress = [workOrder.basic?.address, workOrder.basic?.city, workOrder.basic?.state, workOrder.basic?.zip]
    .filter(Boolean).join(', ');
  
  // Task/Work Order number
  const taskNumber = workOrder.basic?.taskNumber || workOrder._id?.toString().slice(-8) || 'N/A';
  
  // Equipment summary from workOrder.tbs.morning
  const morning = workOrder.tbs?.morning || {};
  const equipmentRows = [
    { item: 'Hard Hats', started: morning.hardHats?.start || 0, ended: morning.hardHats?.end || 0 },
    { item: 'Vests', started: morning.vests?.start || 0, ended: morning.vests?.end || 0 },
    { item: 'Walkie Talkies', started: morning.walkies?.start || 0, ended: morning.walkies?.end || 0 },
    { item: 'Arrow Boards', started: morning.arrowBoards?.start || 0, ended: morning.arrowBoards?.end || 0 },
    { item: 'Cones', started: morning.cones?.start || 0, ended: morning.cones?.end || 0 },
    { item: 'Barrels', started: morning.barrels?.start || 0, ended: morning.barrels?.end || 0 },
    { item: 'Sign Stands', started: morning.signStands?.start || 0, ended: morning.signStands?.end || 0 },
    { item: 'Signs', started: morning.signs?.start || 0, ended: morning.signs?.end || 0 }
  ];

  const equipmentHtml = equipmentRows.map(row => 
    `<tr><td style="padding: 8px 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: 500;">${row.item}</td><td style="padding: 8px 12px; border: 1px solid #e0e0e0; text-align: center; background: #f0f8ff;">${row.started}</td><td style="padding: 8px 12px; border: 1px solid #e0e0e0; text-align: center; background: #f0f8ff;">${row.ended}</td></tr>`
  ).join('');

  // Jobsite checklist from workOrder.tbs.jobsite
  const jobsite = workOrder.tbs?.jobsite || {};
  const checklistItems = [
    { label: 'Visibility', value: jobsite.visibility ? 'Yes' : 'No' },
    { label: 'Communication', value: jobsite.communication ? 'Yes' : 'No' },
    { label: 'Site Foreman', value: jobsite.siteForeman ? 'Yes' : 'No' },
    { label: 'Signs/Stands', value: jobsite.signsAndStands ? 'Yes' : 'No' },
    { label: 'Cones/Taper', value: jobsite.conesAndTaper ? 'Yes' : 'No' },
    { label: 'Equipment Left', value: jobsite.equipmentLeft ? 'Yes' : 'No' }
  ];

  const checklistHtml = checklistItems.map(item => 
    `<div style="display: flex; align-items: center; margin: 6px 0; padding: 4px 8px; background: ${item.value === 'Yes' ? '#e8f5e8' : '#fff3cd'}; border-radius: 4px; border-left: 3px solid ${item.value === 'Yes' ? '#28a745' : '#ffc107'};"><span style="color: ${item.value === 'Yes' ? '#28a745' : '#856404'}; font-weight: bold; margin-right: 8px;">${item.value === 'Yes' ? '✓' : '⚠'}</span><strong style="margin-right: 8px;">${item.label}:</strong><span style="color: ${item.value === 'Yes' ? '#28a745' : '#856404'}; font-weight: 600;">${item.value}</span></div>`
  ).join('');

  return `
    <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8f2ff 100%); padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid #007bff; box-shadow: 0 4px 12px rgba(0,123,255,0.15); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="background: #007bff; color: white; padding: 12px 16px; border-radius: 8px; margin: -20px -20px 20px -20px; box-shadow: 0 2px 8px rgba(0,123,255,0.3);">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">✅ Work Order Completed</h2>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Completed on ${completedDate.toLocaleDateString()} at ${completedDate.toLocaleTimeString()}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #17a2b8; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h4 style="margin: 0 0 12px 0; color: #17a2b8; font-size: 16px; border-bottom: 2px solid #17a2b8; padding-bottom: 4px;">📋 Job Details</h4>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Task #:</strong> <span style="color: #007bff; font-weight: 600;">${taskNumber}</span></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Coordinator:</strong> ${workOrder.basic?.coordinator || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Project:</strong> ${workOrder.basic?.project || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Rating:</strong> <span style="color: #28a745; font-weight: 600;">${workOrder.basic?.rating || 'N/A'}</span></p>
        </div>
        
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #28a745; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h4 style="margin: 0 0 12px 0; color: #28a745; font-size: 16px; border-bottom: 2px solid #28a745; padding-bottom: 4px;">📍 Location & Team</h4>
          <p style="margin: 4px 0; font-size: 14px; line-height: 1.4;"><strong>Address:</strong><br/><span style="color: #495057; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 2px;">${fullAddress || 'N/A'}</span></p>
          <p style="margin: 8px 0 4px 0; font-size: 14px;"><strong>Foreman:</strong> ${workOrder.basic?.foremanName || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Flaggers:</strong> ${[workOrder.tbs?.flagger1, workOrder.tbs?.flagger2, workOrder.tbs?.flagger3, workOrder.tbs?.flagger4, workOrder.tbs?.flagger5].filter(Boolean).join(', ') || 'N/A'}</p>
          ${workOrder.tbs?.trucks?.length ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Trucks:</strong> ${workOrder.tbs.trucks.join(', ')}</p>` : ''}
        </div>
      </div>
      
      <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h4 style="margin: 0 0 12px 0; color: #6f42c1; font-size: 16px; border-bottom: 2px solid #6f42c1; padding-bottom: 4px;">🛠️ Equipment Summary</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: linear-gradient(135deg, #6f42c1, #8e44ad); color: white;">
                <th style="padding: 12px 16px; text-align: left; font-weight: 600;">Equipment Item</th>
                <th style="padding: 12px 16px; text-align: center; font-weight: 600;">Started With</th>
                <th style="padding: 12px 16px; text-align: center; font-weight: 600;">Ended With</th>
              </tr>
            </thead>
            <tbody>
              ${equipmentHtml}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h4 style="margin: 0 0 12px 0; color: #fd7e14; font-size: 16px; border-bottom: 2px solid #fd7e14; padding-bottom: 4px;">✅ Jobsite Checklist</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
          ${checklistHtml}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #20c997;">
          <p style="margin: 4px 0; font-size: 14px;"><strong>24hr Notice:</strong> <span style="color: ${workOrder.basic?.notice24 === 'Yes' ? '#28a745' : '#dc3545'}; font-weight: 600;">${workOrder.basic?.notice24 === 'Yes' ? '✓ Yes' : '✗ No'}</span></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Call Back:</strong> <span style="color: ${workOrder.basic?.callBack === 'Yes' ? '#28a745' : '#dc3545'}; font-weight: 600;">${workOrder.basic?.callBack === 'Yes' ? '✓ Yes' : '✗ No'}</span></p>
        </div>
        
        ${workOrder.foremanSignature ? `<div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;"><strong style="font-size: 14px;">Foreman Signature:</strong><br/><img src="data:image/png;base64,${workOrder.foremanSignature}" alt="Foreman Signature" style="max-width: 180px; max-height: 70px; border: 2px solid #007bff; border-radius: 4px; margin-top: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"/></div>` : '<div></div>'}
      </div>
      
      ${jobsite.equipmentLeft ? `<div style="margin: 16px 0; padding: 16px; background: linear-gradient(135deg, #fff3cd, #ffeaa7); border: 2px solid #ffc107; border-radius: 8px; box-shadow: 0 2px 8px rgba(255,193,7,0.2);"><h4 style="margin: 0 0 8px 0; color: #856404; display: flex; align-items: center;">⚠️ Equipment Left Behind</h4><p style="margin: 0; color: #856404; font-weight: 500; line-height: 1.4;">${jobsite.equipmentLeftReason || 'Equipment was left at the jobsite as requested by client.'}</p></div>` : ''}
      
      ${workOrder.basic?.notes ? `<div style="margin: 16px 0; padding: 16px; background: #f8f9fa; border-left: 4px solid #6c757d; border-radius: 0 8px 8px 0;"><strong style="color: #495057; font-size: 14px;">📝 Additional Notes:</strong><p style="margin: 8px 0 0 0; color: #495057; line-height: 1.4; font-style: italic;">${workOrder.basic.notes}</p></div>` : ''}
    </div>
  `;
}

// Create "In-Reply-To" / "References" headers if we have an origin Message-ID
function threadHeaders(invoiceDoc) {
  const headers = {};
  if (invoiceDoc?.emailMessageId) {
    headers['In-Reply-To'] = invoiceDoc.emailMessageId;
    headers['References']  = invoiceDoc.emailMessageId;
  }
  return headers;
}

// Fallback minimalist invoice PDF if your main generator fails
async function fallbackInvoicePdf(workOrder, total, data) {
  const { logo } = loadStdAssets?.() || {};
  const safe = n => Number(n || 0).toFixed(2);
  const html = `
  <html><head><meta charset="utf-8"></head>
  <body style="font-family:Arial;padding:24px">
    <div style="display:flex;align-items:center;gap:12px">
      ${logo ? `<img src="${logo}" style="height:50px" />` : ''}
      <h1 style="margin:0">Invoice</h1>
    </div>
    <p><strong>Client:</strong> ${workOrder.basic?.client || ''}</p>
    <p><strong>Project:</strong> ${workOrder.basic?.project || ''}</p>
    <p><strong>Date of Job:</strong> ${workOrder.basic?.dateOfJob || ''}</p>
    <hr/>
    <p><strong>Amount Due:</strong> $${safe(total)}</p>
    ${data?.dueDate ? `<p><strong>Due:</strong> ${new Date(data.dueDate).toLocaleDateString()}</p>` : ''}
  </body></html>`;
  try {
    return await printHtmlToPdfBuffer(html);
  } catch {
    return null;
  }
}

// Use the imported generateReceiptPdf from receiptPDF.js service
 const { exportInvoicesXlsx } = require('../services/invoiceExcel');
 const { currentTotal } = require('../utils/invoiceMath');
 const { transporter7 } = require('../utils/emailConfig');
 const { computeTotalFromSelections } = require('../utils/pricing');
 const authJwt = require('../middleware/authJwt');
const PriceList = require('../models/priceList');
const multer = require('multer');

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});



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
      tbsInvoiceNumber,
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

// Build paymentDetails based on payment method and available data
let paymentDetails = '';
if (paymentMethod === 'card') {
  if (stripeResult) {
    paymentDetails = `${(stripeResult.cardBrand || '').toUpperCase()} ****${stripeResult.cardLast4 || ''}`;
  } else if (cardLast4 && cardType) {
    paymentDetails = `${cardType} ****${cardLast4}`;
  } else {
    paymentDetails = 'Credit/Debit Card';
  }
} else if (paymentMethod === 'check') {
  paymentDetails = checkNumber ? `Check #${checkNumber}` : 'Check';
} else {
  paymentDetails = paymentMethod || 'Unknown';
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
const invoiceDocForReceipt = await findInvoiceForWorkOrder(workOrder);
const headers = threadHeaders(invoiceDocForReceipt);
const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');

const tbsInvoiceText = tbsInvoiceNumber ? ` – TBS#${tbsInvoiceNumber}` : '';
const mailOptions = {
  from: 'trafficandbarriersolutions.ap@gmail.com',
  to: emailOverride,
  subject: `Re: INVOICE – ${workOrder.basic?.client}${tbsInvoiceText} – PAYMENT RECEIPT $${actualPaid.toFixed(2)}`,
  html: receiptHtml,
  headers,
  attachments: []
};

// Generate and attach receipt PDF
let receiptPdfBuffer = null;
try {
  const paymentData = {
    _id: workOrder._id,
    workOrder: workOrder,
    paymentAmount: actualPaid,
    totalOwed: totalOwedFinal,
    paymentMethod: paymentMethod,
    paymentDate: new Date(),
    cardType: stripeResult?.cardBrand || cardType,
    cardLast4: stripeResult?.cardLast4 || cardLast4,
    checkNumber: checkNumber,
    stripePaymentIntentId: stripePaymentIntentId,
    receiptNumber: `RCP-${workOrder._id.toString().slice(-8).toUpperCase()}`
  };
  
  console.log('[receipt] Generating PDF with payment data:', {
    paymentAmount: paymentData.paymentAmount,
    paymentMethod: paymentData.paymentMethod,
    cardType: paymentData.cardType,
    cardLast4: paymentData.cardLast4
  });
  
  receiptPdfBuffer = await generateReceiptPdf(paymentData);
  
  if (receiptPdfBuffer && receiptPdfBuffer.length > 0) {
    console.log('[receipt] PDF generated successfully, size:', receiptPdfBuffer.length, 'bytes');
    mailOptions.attachments.push({
      filename: `receipt-${safeClient}.pdf`,
      content: receiptPdfBuffer,
      contentType: 'application/pdf',
      contentDisposition: 'attachment'
    });
  } else {
    console.warn('[receipt] PDF generation returned empty buffer');
  }
} catch (pdfError) {
  console.error('[receipt] PDF generation failed:', pdfError);
  // Continue without PDF attachment - email will still be sent
}

const emailResult = await transporter7.sendMail(mailOptions);
        console.log('[receipt] email sent successfully to:', emailOverride, {
          messageId: emailResult.messageId,
          attachmentCount: mailOptions.attachments.length,
          pdfAttached: !!receiptPdfBuffer
        });
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
        // Skip automatic late fee calculation - fees must be added manually
        // const lateFeeIntervals = Math.floor(daysPastDue / 14);
        // const lateFeeAmount = lateFeeIntervals * 25; // $25 per 14-day period
        
        // Only send notification emails, no automatic fee processing
        processed++;
          
          // Send overdue reminder email (no automatic fees)
          const clientEmail = workOrder.invoiceData?.selectedEmail || workOrder.basic?.email;
          if (clientEmail) {
            try {
              const originalTotal = workOrder.billedAmount || workOrder.invoiceData?.sheetTotal || 0;
              
              const emailHtml = `
                <html>
                  <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
                    <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
                      <h1 style="text-align: center; background-color: #dc3545; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">OVERDUE NOTICE - ${workOrder.basic?.client}</h1>
                      
                      <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #f5c6cb;">
                        <p style="margin: 5px 0; font-size: 16px;"><strong>Amount Due:</strong> $${originalTotal.toFixed(2)}</p>
                        <p style="margin: 5px 0;"><strong>Days Past Due:</strong> ${daysPastDue}</p>
                        <p style="margin: 5px 0;"><strong>Original Due Date:</strong> ${new Date(workOrder.invoiceData.dueDate).toLocaleDateString()}</p>
                      </div>
                      
                      <p style="text-align: center; font-size: 16px; margin: 30px 0;">Your invoice is past due. Please remit payment immediately.</p>
                      
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
                subject: `OVERDUE NOTICE – ${workOrder.basic?.client} – $${originalTotal.toFixed(2)}`,
                html: emailHtml
              };
              
              await transporter7.sendMail(mailOptions);
              emailsSent++;
              console.log(`[overdue-notice] Email sent to ${clientEmail} for work order ${workOrder._id}`);
            } catch (emailError) {
              console.error(`[overdue-notice] Failed to send email for work order ${workOrder._id}:`, emailError);
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
router.post('/update-invoice', upload.array('attachments', 10), async (req, res) => {
  try {
    let { workOrderId, manualAmount, emailOverride, invoiceData, tbsInvoiceNumber } = req.body;
    
    // Handle FormData payload
    if (typeof req.body.payload === 'string') {
      const parsed = JSON.parse(req.body.payload);
      workOrderId = parsed.workOrderId;
      manualAmount = parsed.manualAmount;
      emailOverride = parsed.emailOverride;
      invoiceData = parsed.invoiceData;
      tbsInvoiceNumber = parsed.tbsInvoiceNumber;
    }
    const WorkOrder = require('../models/workorder');

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ message: 'Work order not found' });
    
    // Check if work order has been billed OR has an associated invoice
    const hasInvoice = workOrder.invoiceId || workOrder.billed;
    if (!hasInvoice) {
      // Try to find an invoice by job field as fallback
      const existingInvoice = await Invoice.findOne({ job: workOrder._id }).lean();
      if (!existingInvoice) {
        return res.status(400).json({ message: 'Work order not yet billed' });
      }
    }
const previousTotal = await getPreviousTotal(workOrder._id);
console.log(`[update-invoice] previousTotal=${previousTotal}`);
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
    // Resolve the specific invoice to update: prefer WO.invoiceId, else latest for job
    let targetInvoiceId = workOrder.invoiceId;
    if (!targetInvoiceId) {
      const latest = await Invoice.find({ job: workOrder._id })
        .sort({ sentAt: -1, updatedAt: -1, createdAt: -1 })
        .limit(1)
        .lean();
      targetInvoiceId = latest?.[0]?._id;
    }
    if (!targetInvoiceId) {
      return res.status(404).json({ message: 'No prior invoice found to update for this work order' });
    }

    const invoiceUpdateResult = await Invoice.updateOne({ _id: targetInvoiceId }, { $set: updateData });

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
      console.log('[update-invoice] Using uploaded PDFs, count:', req.files?.length || 0);

      const emailHtml = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #17365D; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">UPDATED Invoice - ${workOrder.basic?.client}</h1>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p><strong>Previous Total:</strong> $${previousTotal.toFixed(2)}</p>
<p><strong>Updated Total:</strong> $${finalInvoiceTotal.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Work Order Date:</strong> ${workOrder.basic?.dateOfJob}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${workOrder.basic?.project}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'Same as original'}</p>
              </div>
              
              ${generateWorkOrderDetailsHtml(workOrder)}
              
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
// Load the related invoice (for threading)
const invoiceDoc = await Invoice.findById(targetInvoiceId).lean().catch(() => null);

// Threading headers
const headers = threadHeaders(invoiceDoc);

const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');

const mailOptions = {
  from: 'trafficandbarriersolutions.ap@gmail.com',
  to: emailOverride,
  subject: `UPDATED INVOICE – ${workOrder.basic?.client}${tbsInvoiceNumber ? ` – TBS#${tbsInvoiceNumber}` : ''} – $${Number(finalInvoiceTotal).toFixed(2)}`,
  html: emailHtml,
  attachments: [],
  headers, // <- In-Reply-To + References (if available)
  // use a unique but related message id
  messageId: `invoice-${String(invoiceDoc?._id || workOrder._id)}-update-${Date.now()}@trafficbarriersolutions.com`
};

// Attach uploaded PDFs instead of generating new ones
if (req.files && req.files.length > 0) {
  req.files.forEach((file, index) => {
    mailOptions.attachments.push({
      filename: file.originalname || `updated-invoice-${safeClient}-${index + 1}.pdf`,
      content: file.buffer,
      contentType: 'application/pdf',
      contentDisposition: 'attachment'
    });
  });
  console.log('[update-invoice] Attached', req.files.length, 'uploaded PDF(s)');
} else {
  console.log('[update-invoice] No uploaded PDFs found, email will be sent without attachments');
}

try {
  const info = await transporter7.sendMail(mailOptions);
  console.log('[update-invoice] email sent to:', emailOverride, 'threaded:', !!headers['In-Reply-To']);
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

router.post('/bill-workorder', upload.array('attachments', 10), async (req, res) => {
  console.log('*** BILLING ROUTER - BILL WORKORDER HIT ***');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    let { workOrderId, manualAmount, emailOverride, invoiceData, tbsInvoiceNumber } = req.body;
    
    // Handle FormData payload
    if (typeof req.body.payload === 'string') {
      const parsed = JSON.parse(req.body.payload);
      workOrderId = parsed.workOrderId;
      manualAmount = parsed.manualAmount;
      emailOverride = parsed.emailOverride;
      invoiceData = parsed.invoiceData;
      tbsInvoiceNumber = parsed.tbsInvoiceNumber;
    }
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

    // Send invoice email with uploaded PDFs
    console.log('Email override value:', emailOverride);
    if (emailOverride) {
      console.log('Attempting to send email to:', emailOverride);
      
      // Use uploaded PDFs instead of generating new ones
      console.log('[invoice] Using uploaded PDFs, count:', req.files?.length || 0);

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
              
              ${generateWorkOrderDetailsHtml(workOrder)}
              
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
// BEFORE sending:
const safeClient = (workOrder.basic?.client || 'client').replace(/[^a-z0-9]+/gi, '-');

const mailOptions = {
  from: 'trafficandbarriersolutions.ap@gmail.com',
  to: emailOverride,
  subject: `INVOICE – ${workOrder.basic?.client}${tbsInvoiceNumber ? ` – TBS#${tbsInvoiceNumber}` : ''} – $${Number(finalInvoiceTotal).toFixed(2)}`,
  html: emailHtml,
  attachments: [],
  // Deterministic message-id starts the thread
  messageId: `invoice-${String(invoice._id)}@trafficbarriersolutions.com`
};

// Attach uploaded PDFs instead of generating new ones
if (req.files && req.files.length > 0) {
  req.files.forEach((file, index) => {
    mailOptions.attachments.push({
      filename: file.originalname || `invoice-${safeClient}-${index + 1}.pdf`,
      content: file.buffer,
      contentType: 'application/pdf',
      contentDisposition: 'attachment'
    });
  });
  console.log('[invoice] Attached', req.files.length, 'uploaded PDF(s)');
} else {
  console.log('[invoice] No uploaded PDFs found, email will be sent without attachments');
}

try {
  const info = await transporter7.sendMail(mailOptions);

  // ⬅️ Save origin message-id so later emails can thread to it
  await Invoice.updateOne(
  { _id: invoice._id },
  { $set: { emailMessageId: info.messageId || mailOptions.messageId } }
);

  console.log('[invoice] email sent', {
    to: emailOverride,
    messageId: info.messageId,
    attached: !!mailOptions.attachments.length
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
// Get single invoice by ID
router.get('/invoice/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (e) {
    console.error('[GET /billing/invoice/:id] error:', e);
    res.status(500).json({ message: 'Failed to fetch invoice' });
  }
});

// Get invoice status for one or more work orders
router.get('/invoice-status', async (req, res) => {
  try {
    const idsParam = (req.query.workOrderIds || '').trim();
    if (!idsParam) return res.json({ byWorkOrder: {} });

    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
    const latestPerJob = await Invoice.aggregate([
      { $match: { job: { $in: objectIds } } },
      // order newest first (sentAt, then updatedAt, then createdAt)
      { $sort: { sentAt: -1, updatedAt: -1, createdAt: -1 } },
      // keep only the first doc per job
      { $group: {
          _id: '$job',
          doc: { $first: '$$ROOT' }
      }},
      { $project: {
          _id: 0,
          job: '$_id',
          invoiceId: '$doc._id',
          status: '$doc.status',
          principal: '$doc.principal',
          accruedInterest: '$doc.accruedInterest',
          computedTotalDue: '$doc.computedTotalDue',
          interestStepsEmailed: '$doc.interestStepsEmailed',
          sentAt: '$doc.sentAt',
          paidAt: '$doc.paidAt',
          publicKey: '$doc.publicKey',
          emailMessageId: '$doc.emailMessageId'
      }}
    ]);

    const byWorkOrder = {};
    for (const inv of latestPerJob) {
      byWorkOrder[String(inv.job)] = {
        invoiceId: String(inv.invoiceId),
        status: inv.status,
        principal: Number(inv.principal) || 0,
        accruedInterest: Number(inv.accruedInterest) || 0,
        computedTotalDue: Number(inv.computedTotalDue) || 0,
        interestStepsEmailed: Number(inv.interestStepsEmailed) || 0,
        sentAt: inv.sentAt || null,
        paidAt: inv.paidAt || null,
        publicKey: inv.publicKey || null,
        emailMessageId: inv.emailMessageId || null
      };
    }
    res.json({ byWorkOrder });
  } catch (e) {
    console.error('[GET /billing/invoice-status] error:', e);
    res.status(500).json({ message: 'Failed to load invoice status' });
  }
});
// POST endpoint to detect PDF total (simplified without pdf-parse)
router.post('/detect-pdf-total', upload.array('pdfs', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No PDF files uploaded' });
    }

    // For now, return a placeholder response since pdf-parse is not available
    res.json({
      detectedTotal: null,
      message: 'PDF parsing not available - please enter total manually',
      success: false
    });
  } catch (error) {
    console.error('PDF detection error:', error);
    res.status(500).json({
      message: 'Failed to process PDF',
      error: error.message,
      success: false
    });
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
router.post('/bill-plan', upload.array('attachments', 10), async (req, res) => {
  try {
    let { planId, manualAmount, emailOverride, invoiceData, tbsInvoiceNumber } = req.body;
    if (typeof req.body.payload === 'string') {
      ({ planId, manualAmount, emailOverride, invoiceData, tbsInvoiceNumber } = JSON.parse(req.body.payload));
    }
    if (!planId) return res.status(400).json({ message: 'planId required' });

    const plan = await PlanUser.findById(planId).lean();
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const principal = Number(manualAmount || 0);
    if (!(principal > 0)) return res.status(400).json({ message: 'Amount must be > 0' });

    // create invoice row (plan-specific)
    const invoice = await Invoice.create({
      plan: plan._id,
      company: plan.company,
      companyEmail: emailOverride,
      principal,
      status: 'SENT',
      sentAt: new Date(),
      dueDate: invoiceData?.dueDate ? new Date(invoiceData.dueDate) : undefined,
      invoiceData, // snapshot: phases, rate, totals, etc.
      invoiceNumber: invoiceData?.invoiceNumber || String(plan._id).slice(-6),
      lineItems: [
        {
          description: `Traffic Control Plan — ${invoiceData?.planPhases || 1} phase(s) @ $${Number(invoiceData?.planRate||0).toFixed(2)}`,
          qty: Number(invoiceData?.planPhases || 1),
          unitPrice: Number(invoiceData?.planRate || 0),
          total: principal
        }
      ],
      billedTo: {
        name: plan.company,
        email: emailOverride
      }
    });

    // email with enhanced styling
    const safeCo = (plan.company || 'company').replace(/[^a-z0-9]+/gi, '-');
    const html = `
      <html>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
          <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
            <h1 style="text-align: center; background-color: #efad76; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">Traffic Control Plan Invoice - ${plan.company}</h1>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>Invoice Amount:</strong> $${principal.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Company:</strong> ${plan.company}</p>
              <p style="margin: 5px 0;"><strong>Project:</strong> ${plan.project || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            
            ${generatePlanDetailsHtml(plan, invoiceData)}
            
            <p style="text-align: center; font-size: 16px; margin: 30px 0;">Please find the attached invoice PDF. Thank you for your business!</p>
            
            <div style="text-align: center; border-top: 2px solid #efad76; padding-top: 15px; margin-top: 30px;">
              <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
              <p style="margin: 5px 0;">1999 Dews Pond Rd SE, Calhoun, GA 30701</p>
              <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
            </div>
          </div>
        </body>
      </html>`;

    const mailOptions = {
      from: 'trafficandbarriersolutions.ap@gmail.com',
      to: emailOverride,
      subject: `Traffic Control Plan – INVOICE – ${plan.company}${tbsInvoiceNumber ? ` – TBS#${tbsInvoiceNumber}` : ''} – $${principal.toFixed(2)}`,
      html,
      attachments: [],
      messageId: `plan-invoice-${String(invoice._id)}@trafficbarriersolutions.com`
    };

    if (req.files?.length) {
      req.files.forEach((f, i) => {
        mailOptions.attachments.push({
          filename: f.originalname || `tcp-invoice-${safeCo}-${i+1}.pdf`,
          content: f.buffer,
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        });
      });
    }

    const info = await transporter7.sendMail(mailOptions);
    await Invoice.updateOne(
      { _id: invoice._id },
      { $set: { emailMessageId: mailOptions.messageId || info.messageId } }
    );

    return res.json({ ok: true, invoiceId: invoice._id });
  } catch (e) {
    console.error('[bill-plan] error:', e);
    res.status(500).json({ message: 'Failed to bill plan', error: e.message });
  }
});
router.post('/update-plan', upload.array('attachments', 10), async (req, res) => {
  try {
    let { planId, manualAmount, emailOverride, invoiceData, tbsInvoiceNumber } = req.body;
    if (typeof req.body.payload === 'string') {
      ({ planId, manualAmount, emailOverride, invoiceData, tbsInvoiceNumber } = JSON.parse(req.body.payload));
    }
    if (!planId) return res.status(400).json({ message: 'planId required' });

    const plan = await PlanUser.findById(planId).lean();
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const target = await findInvoiceForPlan(planId);
    if (!target) return res.status(404).json({ message: 'No prior plan invoice to update' });

    const principal = Number(manualAmount || 0);
    if (!(principal > 0)) return res.status(400).json({ message: 'Amount must be > 0' });

    await Invoice.updateOne(
      { _id: target._id },
      {
        $set: {
          principal,
          invoiceData,
          invoiceNumber: invoiceData?.invoiceNumber || target.invoiceNumber,
          dueDate: invoiceData?.dueDate ? new Date(invoiceData.dueDate) : target.dueDate,
          status: 'SENT', // keep it "sent" (or PARTIALLY_PAID/PAID stays if you prefer)
          lineItems: [
            {
              description: `Traffic Control Plan — ${invoiceData?.planPhases || 1} phase(s) @ $${Number(invoiceData?.planRate||0).toFixed(2)}`,
              qty: Number(invoiceData?.planPhases || 1),
              unitPrice: Number(invoiceData?.planRate || 0),
              total: principal
            }
          ],
          updatedAt: new Date()
        }
      }
    );

    // Threaded email with enhanced styling
    const headers = threadHeaders(target);
    const safeCo = (plan.company || 'company').replace(/[^a-z0-9]+/gi, '-');
    const html = `
      <html>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
          <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
            <h1 style="text-align: center; background-color: #17365D; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">UPDATED Traffic Control Plan Invoice - ${plan.company}</h1>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>Updated Total:</strong> $${principal.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Company:</strong> ${plan.company}</p>
              <p style="margin: 5px 0;"><strong>Project:</strong> ${plan.project || 'N/A'}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'Same as original'}</p>
            </div>
            
            ${generatePlanDetailsHtml(plan, invoiceData)}
            
            <p style="text-align: center; font-size: 16px; margin: 30px 0;">This is an updated version of your invoice. Please find the revised invoice PDF attached.</p>
            
            <div style="text-align: center; border-top: 2px solid #17365D; padding-top: 15px; margin-top: 30px;">
              <p style="margin: 5px 0; font-weight: bold;">Traffic & Barrier Solutions, LLC</p>
              <p style="margin: 5px 0;">1999 Dews Pond Rd SE, Calhoun, GA 30701</p>
              <p style="margin: 5px 0;">Phone: (706) 263-0175</p>
            </div>
          </div>
        </body>
      </html>`;

    const mailOptions = {
      from: 'trafficandbarriersolutions.ap@gmail.com',
      to: emailOverride,
      subject: `UPDATED TCP INVOICE – ${plan.company}${tbsInvoiceNumber ? ` – TBS#${tbsInvoiceNumber}` : ''} – $${principal.toFixed(2)}`,
      html,
      headers,
      attachments: [],
      messageId: `plan-invoice-${String(target._id)}-update-${Date.now()}@trafficbarriersolutions.com`
    };

    if (req.files?.length) {
      req.files.forEach((f, i) => {
        mailOptions.attachments.push({
          filename: f.originalname || `tcp-invoice-${safeCo}-${i+1}.pdf`,
          content: f.buffer,
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        });
      });
    }

    await transporter7.sendMail(mailOptions);
    return res.json({ ok: true, invoiceId: target._id });
  } catch (e) {
    console.error('[update-plan] error:', e);
    res.status(500).json({ message: 'Failed to update plan invoice', error: e.message });
  }
});
// Helper function to find invoice for plan
async function findInvoiceForPlan(planId) {
  if (!planId) return null;
  const [latest] = await Invoice.find({ plan: planId })
    .sort({ sentAt: -1, updatedAt: -1, createdAt: -1 })
    .limit(1)
    .lean()
    .catch(() => [null]);
  return latest || null;
}

// Mark plan invoice as paid
router.post('/mark-plan-paid', async (req, res) => {
  try {
    const { invoiceId, paymentMethod, paymentAmount, emailOverride, cardType, cardLast4, checkNumber, tbsInvoiceNumber } = req.body;
    
    if (!invoiceId) return res.status(400).json({ message: 'invoiceId required' });
    
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    const amount = Number(paymentAmount) || invoice.principal || 0;
    
    // Update invoice status
    await Invoice.updateOne(
      { _id: invoiceId },
      { 
        $set: { 
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: paymentMethod === 'card' ? 'CARD' : 'CHECK'
        }
      }
    );
    
    // Send receipt email if provided
    if (emailOverride) {
      const plan = await PlanUser.findById(invoice.plan).lean();
      const receiptHtml = `
        <html>
          <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7; color: #000;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px;">
              <h1 style="text-align: center; background-color: #28a745; color: white; padding: 15px; border-radius: 6px; margin: 0 0 20px 0;">Payment Receipt - ${plan?.company || 'Traffic Control Plan'}</h1>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; font-size: 16px;"><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${paymentMethod === 'card' ? 'Credit/Debit Card' : 'Check'}</p>
                ${paymentMethod === 'card' && cardType ? `<p style="margin: 5px 0;"><strong>Card Type:</strong> ${cardType}</p>` : ''}
                ${paymentMethod === 'card' && cardLast4 ? `<p style="margin: 5px 0;"><strong>Card Ending:</strong> ****${cardLast4}</p>` : ''}
                ${paymentMethod === 'check' && checkNumber ? `<p style="margin: 5px 0;"><strong>Check Number:</strong> ${checkNumber}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Company:</strong> ${plan?.company || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${plan?.project || 'N/A'}</p>
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
const headers = threadHeaders(invoice);

const mailOptions = {
  from: 'trafficandbarriersolutions.ap@gmail.com',
  to: emailOverride,
  subject: `Re: Traffic Control Plan${tbsInvoiceNumber ? ` – TBS#${tbsInvoiceNumber}` : ''} – PAYMENT RECEIPT $${amount.toFixed(2)}`,
  html: receiptHtml,
  headers,
  attachments: []
};

// Generate and attach plan receipt PDF
try {
  const planPaymentData = {
    _id: invoiceId,
    workOrder: { basic: { client: plan?.company, project: plan?.project, address: plan?.address, city: plan?.city, state: plan?.state, zip: plan?.zip } },
    paymentAmount: amount,
    totalOwed: amount,
    paymentMethod: paymentMethod,
    paymentDate: new Date(),
    cardType: cardType,
    cardLast4: cardLast4,
    checkNumber: checkNumber,
    receiptNumber: `TCP-${invoiceId.toString().slice(-8).toUpperCase()}`
  };
  
  const receiptPdfBuffer = await generateReceiptPdf(planPaymentData);
  
  if (receiptPdfBuffer && receiptPdfBuffer.length > 0) {
    const safeCompany = (plan?.company || 'plan').replace(/[^a-z0-9]+/gi, '-');
    mailOptions.attachments.push({
      filename: `plan-receipt-${safeCompany}.pdf`,
      content: receiptPdfBuffer,
      contentType: 'application/pdf',
      contentDisposition: 'attachment'
    });
  }
} catch (pdfError) {
  console.error('[plan-receipt] PDF generation failed:', pdfError);
}

await transporter7.sendMail(mailOptions);

    }
    
    res.json({ message: 'Plan payment recorded successfully', invoiceId });
  } catch (e) {
    console.error('Mark plan paid error:', e);
    res.status(500).json({ message: 'Failed to record plan payment', error: e.message });
  }
});

// similar to /invoice-status but for plans
router.get('/plan-invoice-status', async (req, res) => {
  try {
    const ids = String(req.query.planIds || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    if (!ids.length) {
      return res.json({});
    }
    
    const invoices = await Invoice.find({ plan: { $in: ids } })
      .select('plan status principal computedTotalDue accruedInterest paidAt invoiceData')
      .lean();
    
    const result = {};
    
    for (const id of ids) {
      const invoice = invoices.find(inv => String(inv.plan) === id);
      if (invoice) {
        result[id] = {
          billed: true,
          paid: invoice.status === 'PAID',
          invoiceId: invoice._id,
          principal: invoice.principal || 0,
          computedTotalDue: invoice.computedTotalDue || invoice.principal || 0,
          accruedInterest: invoice.accruedInterest || 0,
          paidAt: invoice.paidAt,
          invoiceData: invoice.invoiceData
        };
      } else {
        result[id] = {
          billed: false,
          paid: false,
          invoiceId: null,
          principal: 0,
          computedTotalDue: 0,
          accruedInterest: 0,
          paidAt: null,
          invoiceData: null
        };
      }
    }
    
    res.json(result);
  } catch (e) {
    console.error('Plan invoice status error:', e);
    res.status(500).json({ message: 'Failed to get plan invoice status', error: e.message });
  }
});


// Generate PDF receipt for a payment
router.get('/receipt/:workOrderId/pdf', async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const WorkOrder = require('../models/workorder');
    
    const workOrder = await WorkOrder.findById(workOrderId).lean();
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    if (!workOrder.paid && !workOrder.lastPaymentAmount) {
      return res.status(400).json({ error: 'No payment found for this work order' });
    }
    
    // Build payment data for receipt
    const paymentData = {
      _id: workOrder._id,
      workOrder: workOrder,
      paymentAmount: workOrder.lastPaymentAmount || workOrder.billedAmount,
      totalOwed: workOrder.billedAmount || workOrder.invoiceTotal,
      paymentMethod: workOrder.paymentMethod || 'Unknown',
      paymentDate: workOrder.lastPaymentAt || workOrder.paidAt || new Date(),
      cardLast4: workOrder.cardLast4,
      checkNumber: workOrder.checkNumber,
      receiptNumber: `RCP-${workOrder._id.toString().slice(-8).toUpperCase()}`
    };
    
    const pdfBuffer = await generateReceiptPdf(paymentData);
    
    if (!pdfBuffer) {
      return res.status(500).json({ error: 'Failed to generate receipt PDF' });
    }
    
    const safeClient = (workOrder.basic?.client || 'client').replace(/\s+/g, '_');
    const filename = `receipt_${safeClient}_${workOrder.basic?.project || 'project'}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Failed to generate receipt PDF' });
  }
});

module.exports = router;

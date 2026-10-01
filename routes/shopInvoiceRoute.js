const express = require('express');
const router = express.Router();
const ShopInvoice = require('../models/shopinvoice');
const Quote = require('../models/quoteuser');
const { transporter } = require('../utils/emailConfig');
const { generateInvoicePdf } = require('../services/quotePDF');

// Get last invoice number used
router.get('/shop-invoices/last-number', async (req, res) => {
  try {
    const all = await ShopInvoice.find({ invoiceNumber: /^2026SS/i }).select('invoiceNumber');
    if (!all.length) return res.json({ lastNumber: '' });
    const highest = all.reduce((best, inv) => {
      return (inv.invoiceNumber || '').localeCompare(best, undefined, { numeric: true }) > 0 ? inv.invoiceNumber : best;
    }, '');
    res.json({ lastNumber: highest });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch last invoice number' });
  }
});

// Get shop invoices by month
router.get('/shop-invoices/month', async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const invoices = await ShopInvoice.find({
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0]
      }
    }).sort({ invoiceNumber: -1 });
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch shop invoices' });
  }
});

// Update shop invoice (checks ShopInvoice first, falls back to Quote collection)
router.put('/shop-invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updated = await ShopInvoice.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!updated) {
      updated = await Quote.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    }
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Resend updated shop invoice email
router.post('/shop-invoices/:id/resend', async (req, res) => {
  try {
    const inv = await ShopInvoice.findById(req.params.id) || await Quote.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const pdfBuffer = await generateInvoicePdf(inv);
    const emailList = inv.email.split(',').map(e => e.trim()).filter(e => e);

    await transporter.sendMail({
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: emailList,
      cc: [
        { name: 'Traffic & Barrier Solutions LLC', address: 'tbsolutions9@gmail.com' },
        { name: 'Carson Speer', address: 'tbsolutions4@gmail.com' },
        { name: 'Dasia Diskey', address: 'materialworx2@gmail.com' },
      ],
      subject: `Updated Invoice #${inv.invoiceNumber} for ${inv.customer} - ${inv.company}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;">
          <h2 style="color:#17365D;">Dear ${inv.customer},</h2>
          <p style="font-size:16px;">Your invoice <strong>#${inv.invoiceNumber}</strong> has been updated. Please see the attached revised invoice.</p>
          <p style="font-size:16px;">If you have any questions, please email us at <a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a>.</p>
          <div style="margin-top:20px;font-size:13px;color:#666;border-top:1px solid #ddd;padding-top:15px;">
            <p><strong>Bryson C Davis</strong></p>
            <p>Traffic &amp; Barrier Solutions, LLC</p>
            <p>723 N Wall Street, Calhoun, GA 30701</p>
          </div>
        </div>`,
      attachments: [{
        filename: `TBS_Invoice_${inv.invoiceNumber}_${inv.customer.replace(/\s+/g, '_')}_${inv.date}.pdf`,
        content: pdfBuffer
      }]
    });

    res.json({ message: 'Invoice resent successfully' });
  } catch (e) {
    console.error('Resend shop invoice error:', e);
    res.status(500).json({ error: 'Failed to resend invoice' });
  }
});

module.exports = router;

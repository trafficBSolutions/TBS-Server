const express = require('express');
const router = express.Router();
const ShopInvoice = require('../models/shopinvoice');

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
    }).sort({ date: -1 });
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch shop invoices' });
  }
});

// Update shop invoice
router.put('/shop-invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cardType, cardLast4, checkNumber, payMethod, notes, taxExemptNumber, computed } = req.body;
    const update = {};
    if (cardType !== undefined) update.cardType = cardType;
    if (cardLast4 !== undefined) update.cardLast4 = cardLast4;
    if (checkNumber !== undefined) update.checkNumber = checkNumber;
    if (payMethod !== undefined) update.payMethod = payMethod;
    if (notes !== undefined) update.notes = notes;
    if (taxExemptNumber !== undefined) update.taxExemptNumber = taxExemptNumber;
    if (computed !== undefined) update.computed = computed;
    const updated = await ShopInvoice.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

module.exports = router;

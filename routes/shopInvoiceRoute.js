const express = require('express');
const router = express.Router();
const ShopInvoice = require('../models/shopinvoice');
const Quote = require('../models/quoteuser');

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

module.exports = router;

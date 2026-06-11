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

module.exports = router;

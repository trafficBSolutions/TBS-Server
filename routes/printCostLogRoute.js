const express = require('express');
const router = express.Router();
const PrintCostLog = require('../models/printcostlog');

// Get all print cost logs for a month
router.get('/print-cost-logs/month', async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const logs = await PrintCostLog.find({
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0]
      }
    }).sort({ date: -1 });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch print cost logs' });
  }
});

// Get a single log by ID
router.get('/print-cost-logs/:id', async (req, res) => {
  try {
    const doc = await PrintCostLog.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

// Create a new print cost log
router.post('/print-cost-logs', async (req, res) => {
  try {
    const { name, date, author, prints } = req.body;
    if (!name || !date) return res.status(400).json({ error: 'Name and date required' });
    const doc = await PrintCostLog.create({ name, date, author, prints: prints || [] });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create log' });
  }
});

// Update a print cost log
router.put('/print-cost-logs/:id', async (req, res) => {
  try {
    const doc = await PrintCostLog.findByIdAndUpdate(req.params.id, { $set: { ...req.body, updatedAt: new Date() } }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update log' });
  }
});

// Delete a print cost log
router.delete('/print-cost-logs/:id', async (req, res) => {
  try {
    await PrintCostLog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

module.exports = router;

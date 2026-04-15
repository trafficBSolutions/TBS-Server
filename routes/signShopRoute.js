const express = require('express');
const router = express.Router();
const SignShopJob = require('../models/signShopJob');

// Get all sign shop jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await SignShopJob.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get jobs for a specific month
router.get('/month', async (req, res) => {
  try {
    const { month, year } = req.query;
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    const jobs = await SignShopJob.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get jobs for a specific day
router.get('/day', async (req, res) => {
  try {
    const { date } = req.query;
    const jobs = await SignShopJob.find({ date }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create new sign shop job
router.post('/', async (req, res) => {
  try {
    const job = new SignShopJob(req.body);
    const saved = await job.save();
    res.status(201).json(saved);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Update sign shop job
router.put('/:id', async (req, res) => {
  try {
    const job = await SignShopJob.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Delete sign shop job
router.delete('/:id', async (req, res) => {
  try {
    const job = await SignShopJob.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

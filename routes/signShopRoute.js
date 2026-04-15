const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SignShopJob = require('../models/signShopJob');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'signshop-photos')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// Get all
router.get('/', async (req, res) => {
  try {
    const jobs = await SignShopJob.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get by month
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

// Get by day
router.get('/day', async (req, res) => {
  try {
    const { date } = req.query;
    const jobs = await SignShopJob.find({ date }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create with photos
router.post('/', upload.array('photos', 5), async (req, res) => {
  try {
    const photos = (req.files || []).map(f => f.filename);
    const job = new SignShopJob({ ...req.body, photos });
    const saved = await job.save();
    res.status(201).json(saved);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const job = await SignShopJob.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Delete (also removes photo files)
router.delete('/:id', async (req, res) => {
  try {
    const job = await SignShopJob.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    (job.photos || []).forEach(photo => {
      const filePath = path.join(__dirname, '..', 'signshop-photos', photo);
      fs.unlink(filePath, () => {});
    });
    res.json({ message: 'Job deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

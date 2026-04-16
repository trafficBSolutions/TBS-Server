const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SignShopJob = require('../models/signShopJob');
const { transporter } = require('../utils/emailConfig');

const uploadDir = path.join(__dirname, '..', 'signshop-photos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
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

    // Send email notification
    const attachments = (req.files || []).map(f => ({
      filename: f.originalname,
      path: f.path
    }));

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: 'tbsolutions9@gmail.com',
      cc: ['tbsolutions1999@gmail.com', 'tbsolutions4@gmail.com'],
      subject: `🪧 New Sign Shop Job: ${saved.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#e67e22;padding:20px;text-align:center;">
            <h1 style="color:#fff;margin:0;">Material WorX - Sign Shop</h1>
          </div>
          <div style="padding:20px;background:#f9f9f9;">
            <h2 style="color:#333;">New Sign Shop Job Added</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Job Title:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${saved.title}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Customer:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${saved.customer || 'N/A'}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Date:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${saved.date}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #ddd;">Added By:</td><td style="padding:8px;border-bottom:1px solid #ddd;">${saved.author}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Description:</td><td style="padding:8px;">${saved.description || 'N/A'}</td></tr>
            </table>
            ${photos.length > 0 ? '<p style="margin-top:16px;color:#555;">📎 ' + photos.length + ' photo(s) attached below.</p>' : ''}
          </div>
          <div style="background:#333;padding:12px;text-align:center;">
            <p style="color:#aaa;margin:0;font-size:12px;">Traffic & Barrier Solutions, LLC / Material WorX</p>
          </div>
        </div>
      `,
      attachments
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error('Sign shop email error:', err);
      else console.log('Sign shop email sent:', info.response);
    });

    res.status(201).json(saved);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Update (with optional new photos)
router.put('/:id', upload.array('photos', 5), async (req, res) => {
  try {
    const job = await SignShopJob.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    if (req.body.title !== undefined) job.title = req.body.title;
    if (req.body.customer !== undefined) job.customer = req.body.customer;
    if (req.body.description !== undefined) job.description = req.body.description;
    if (req.body.completed !== undefined) job.completed = req.body.completed === 'true' || req.body.completed === true;
    if (req.body.date !== undefined) job.date = req.body.date;

    // Remove specific photos if requested
    const removePhotos = req.body.removePhotos ? JSON.parse(req.body.removePhotos) : [];
    if (removePhotos.length > 0) {
      removePhotos.forEach(photo => {
        const filePath = path.join(uploadDir, photo);
        fs.unlink(filePath, () => {});
      });
      job.photos = job.photos.filter(p => !removePhotos.includes(p));
    }

    // Append new photos
    const newPhotos = (req.files || []).map(f => f.filename);
    job.photos = [...job.photos, ...newPhotos];

    const saved = await job.save();
    res.json(saved);
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

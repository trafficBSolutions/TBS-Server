const express = require('express');
const router = express.Router();
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs'); // Import the 'fs' module
const { submitApply } = require('../controllers/autoApplyControl');

// Middleware
router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);

// 📌 Fix: Define Multer storage and upload
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dest = './files';
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true }); // Create folder if it doesn't exist
        }
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const currentDate = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const fileExtension = file.originalname.split('.').pop();
        const uniqueFilename = `${currentDate}_${Math.floor(Math.random() * 10000)}.${fileExtension}`;
        cb(null, uniqueFilename);
    },
});

// 📌 Fix: Ensure correct field names match frontend
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).fields([
    { name: 'resume', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]);

// Use bodyParser to parse URL-encoded and JSON data
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());
console.log("Resume file type:", req.files?.resume?.[0]?.mimetype);
console.log("File size:", req.files?.resume?.[0]?.size);
// 🚀 Fix: Apply Multer Middleware Correctly
router.post('/applynow', (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Multer error: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ error: `Server error: ${err.message}` });
        }
        console.log("Files uploaded:", req.files);
        next();
    });
}, submitApply);
const Apply = require('../models/newapply');

router.get('/apply/all', async (req, res) => {
  try {
    const applicants = await Apply.find().sort({ _id: -1 }); // newest first
    res.json(applicants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve applicants.' });
  }
});
module.exports = router;


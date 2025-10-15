// routes/detect-pdf-total.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

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

// Extract total amount from PDF text
function extractTotalFromText(text) {
  // Common patterns for invoice totals
  const patterns = [
    /total[:\s]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /amount due[:\s]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /balance due[:\s]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /grand total[:\s]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /invoice total[:\s]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*total/gi,
    /final amount[:\s]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
  ];

  const amounts = [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        amounts.push(amount);
      }
    }
  }

  if (amounts.length === 0) return null;

  // Return the highest amount found (likely to be the total)
  return Math.max(...amounts);
}

// POST endpoint to detect PDF total
router.post('/detect-pdf-total', upload.array('pdfs', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No PDF files uploaded' });
    }

    const file = req.files[0]; // Process first file
    
    // Parse PDF
    const pdfData = await pdfParse(file.buffer);
    const text = pdfData.text;
    
    // Extract total
    const detectedTotal = extractTotalFromText(text);
    
    if (detectedTotal) {
      res.json({
        detectedTotal,
        textSample: text.substring(0, 500) + '...',
        success: true
      });
    } else {
      res.json({
        detectedTotal: null,
        message: 'Could not detect total from PDF',
        textSample: text.substring(0, 500) + '...',
        success: false
      });
    }
  } catch (error) {
    console.error('PDF detection error:', error);
    res.status(500).json({
      message: 'Failed to process PDF',
      error: error.message,
      success: false
    });
  }
});

module.exports = router;

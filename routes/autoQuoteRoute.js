const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { submitQuote, getMonthlyQuotes, getDailyQuotes, resendQuote, submitInvoice, approveQuote } = require('../controllers/autoQuoteControl');

router.post('/api/quote', submitQuote);
router.post('/api/invoice', upload.array('attachments'), submitInvoice);
router.get('/api/quotes/month', getMonthlyQuotes);
router.get('/api/quotes/day', getDailyQuotes);
router.post('/api/quotes/:id/resend', resendQuote);
router.get('/api/quotes/:id/approve', approveQuote);

module.exports = router;

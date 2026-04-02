const express = require('express');
const router = express.Router();
const { submitQuote, getMonthlyQuotes, getDailyQuotes, resendQuote, submitInvoice } = require('../controllers/autoQuoteControl');

router.post('/api/quote', submitQuote);
router.post('/api/invoice', submitInvoice);
router.get('/api/quotes/month', getMonthlyQuotes);
router.get('/api/quotes/day', getDailyQuotes);
router.post('/api/quotes/:id/resend', resendQuote);

module.exports = router;

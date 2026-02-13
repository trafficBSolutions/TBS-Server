const express = require('express');
const router = express.Router();
const { submitQuote, getMonthlyQuotes, getDailyQuotes, resendQuote } = require('../controllers/autoQuoteControl');

router.post('/api/quote', submitQuote);
router.get('/api/quotes/month', getMonthlyQuotes);
router.get('/api/quotes/day', getDailyQuotes);
router.post('/api/quotes/:id/resend', resendQuote);

module.exports = router;

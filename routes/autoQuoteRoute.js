const express = require('express');
const router = express.Router();
const { submitQuote } = require('../controllers/autoQuoteControl');

router.post('/api/quote', submitQuote);

module.exports = router;

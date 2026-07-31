const express = require('express');
const router = express.Router();
const { submitHydrovac, getHydrovacByMonth, getHydrovacByDay } = require('../controllers/autoHydrovacControl');

router.post('/hydrovac', submitHydrovac);
router.get('/hydrovac/month', getHydrovacByMonth);
router.get('/hydrovac/day', getHydrovacByDay);

module.exports = router;

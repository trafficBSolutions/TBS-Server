const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const { submitDirectDeposit } = require('../controllers/autoDirectControl');

router.use(cors({
  credentials: true,
  origin: 'https://www.trafficbarriersolutions.com'
}));

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post('/direct-deposit', submitDirectDeposit);

module.exports = router;

const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const { submitBollardWheel } = require('../controllers/autoBollardControl');

// Middleware
router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);


// Use bodyParser to parse URL-encoded and JSON data
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// Define routes under /apply path
router.post('/bollardswheels', submitBollardWheel);
    

module.exports = router;

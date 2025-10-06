const express = require('express');
const router = express.Router();
const cors = require('cors');
const bodyParser = require('body-parser');
const {
  submitComplaint,
  listComplaints,
  listComplaintsByMonth,
  listComplaintsByDate,
  getComplaintById,
} = require('../controllers/complaintController');

router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);
// reads for admin
router.get('/', listComplaints); // ?page=1&limit=50 (optional)
router.get('/month', listComplaintsByMonth); // ?month=10&year=2025
router.get('/day', listComplaintsByDate);    // ?date=2025-10-06
router.get('/:id', getComplaintById);

module.exports = router;
// Use bodyParser to parse URL-encoded and JSON data
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post('/employee-complaint-form', submitComplaint);

module.exports = router;

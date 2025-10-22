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
  generateComplaintPDF,
} = require('../controllers/complaintController');

// Use bodyParser to parse URL-encoded and JSON data
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);

// POST route
router.post('/employee-complaint-form', submitComplaint);

// GET routes for admin - specific routes BEFORE parameterized routes
router.get('/month', listComplaintsByMonth); // ?month=10&year=2025
router.get('/day', listComplaintsByDate);    // ?date=2025-10-06
router.get('/', listComplaints); // ?page=1&limit=50 (optional)
router.get('/:id([0-9a-fA-F]{24})/pdf', generateComplaintPDF); // PDF generation
router.get('/:id([0-9a-fA-F]{24})', getComplaintById); // keep LAST

module.exports = router;

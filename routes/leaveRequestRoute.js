const express = require('express');
const router = express.Router();
const {
  submitLeaveRequest,
  listLeaveRequests,
  getPendingLeaveRequests,
  approveLeaveRequest,
  denyLeaveRequest,
} = require('../controllers/leaveRequestController');

router.post('/leave-request', submitLeaveRequest);
router.get('/leave-requests', listLeaveRequests);
router.get('/leave-requests/pending', getPendingLeaveRequests);
router.post('/leave-requests/:id/approve', approveLeaveRequest);
router.post('/leave-requests/:id/deny', denyLeaveRequest);

module.exports = router;

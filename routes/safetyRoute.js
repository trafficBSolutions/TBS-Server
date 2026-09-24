const express = require('express');
const router = express.Router();
const {
  submitSafetyMeeting, listSafetyMeetingsByMonth, listSafetyMeetingsByDay, getSafetyMeetingPDF,
  submitJobInspection, listJobInspectionsByMonth, listJobInspectionsByDay, getJobInspectionPDF
} = require('../controllers/safetyController');

// Safety Meetings
router.post('/safety-meetings', submitSafetyMeeting);
router.get('/safety-meetings/month', listSafetyMeetingsByMonth);
router.get('/safety-meetings', listSafetyMeetingsByDay);
router.get('/safety-meetings/:id/pdf', getSafetyMeetingPDF);

// Job Inspections
router.post('/job-inspections', submitJobInspection);
router.get('/job-inspections/month', listJobInspectionsByMonth);
router.get('/job-inspections', listJobInspectionsByDay);
router.get('/job-inspections/:id/pdf', getJobInspectionPDF);

module.exports = router;

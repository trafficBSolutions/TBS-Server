// routes/autoDiscipline.js
const express = require('express');
const router = express.Router();
const requireStaff = require('../middleware/requireStaff');
const requireAdmin = require('../middleware/requireAdmin');
const { 
  createAction, getActionsByDay, getActionsByMonth, getActionById, streamPdf 
} = require('../controllers/disciplineController');

// create
router.post('/discipline', requireStaff, createAction);

// calendar day view
router.get('/discipline', requireAdmin, getActionsByDay);            // ?date=YYYY-MM-DD

// calendar month view
router.get('/discipline/month', requireAdmin, getActionsByMonth);    // ?month=10&year=2025

// single
router.get('/discipline/:id', requireAdmin, getActionById);

// PDF (printable)
router.get('/discipline/:id/pdf', requireAdmin, streamPdf);

module.exports = router;

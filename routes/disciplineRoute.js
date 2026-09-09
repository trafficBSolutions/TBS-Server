const express = require('express');
const router = express.Router();
const Discipline = require('../models/discipline');
const {
  addEmployee, listEmployees, deleteEmployee, getEmployeePoints,
  terminateEmployee, adjustPoints,
  submitDiscipline, listByMonth, listByDate, getDisciplinePDF
} = require('../controllers/disciplineController');

// Employee roster
router.get('/employees', listEmployees);
router.post('/employees', addEmployee);
router.delete('/employees/:id', deleteEmployee);
router.get('/employees/:id/points', getEmployeePoints);
router.put('/employees/:id/terminate', terminateEmployee);
router.put('/employees/:id/points', adjustPoints);

// Discipline actions
router.post('/', submitDiscipline);
router.get('/month', listByMonth);
router.get('/', listByDate);
router.get('/:id([0-9a-fA-F]{24})/pdf', getDisciplinePDF);
router.get('/employee-discipline/:id', async (req, res) => {
  try {
    const job = await Discipline.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Write Up not found' });
    }
    res.json(job);
  } catch (err) {
    console.error('Error fetching write up:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
module.exports = router;

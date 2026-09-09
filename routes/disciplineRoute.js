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
router.get('/by-name/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    const records = await Discipline.find({
      employeeName: { $regex: new RegExp(`^${name}$`, 'i') }
    }).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error('Error fetching disciplines by name:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
module.exports = router;

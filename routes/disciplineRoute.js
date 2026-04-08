const express = require('express');
const router = express.Router();
const {
  addEmployee, listEmployees, deleteEmployee, getEmployeePoints,
  submitDiscipline, listByMonth, listByDate, getDisciplinePDF
} = require('../controllers/disciplineController');

// Employee roster
router.get('/employees', listEmployees);
router.post('/employees', addEmployee);
router.delete('/employees/:id', deleteEmployee);
router.get('/employees/:id/points', getEmployeePoints);

// Discipline actions
router.post('/', submitDiscipline);
router.get('/month', listByMonth);
router.get('/', listByDate);
router.get('/:id([0-9a-fA-F]{24})/pdf', getDisciplinePDF);

module.exports = router;

const express = require('express');
const router = express.Router();
const { submitDiscipline, listByMonth, listByDate, getDisciplinePDF } = require('../controllers/disciplineController');

router.post('/', submitDiscipline);
router.get('/month', listByMonth);
router.get('/', listByDate);
router.get('/:id([0-9a-fA-F]{24})/pdf', getDisciplinePDF);

module.exports = router;

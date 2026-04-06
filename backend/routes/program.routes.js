const express = require('express');
const router = express.Router();
const { getAllPrograms, getProgramById, createProgram, updateProgram, deleteProgram } = require('../controllers/program.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.get('/', verifyToken, getAllPrograms);
router.get('/:id', verifyToken, getProgramById);
router.post('/', verifyToken, requireRole('admin', 'officer'), createProgram);
router.put('/:id', verifyToken, requireRole('admin', 'officer'), updateProgram);
router.delete('/:id', verifyToken, requireRole('admin'), deleteProgram);

module.exports = router;

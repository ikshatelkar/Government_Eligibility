const express = require('express');
const router = express.Router();
const { submitApplication, getMyApplications, getAllApplications, updateApplicationStatus } = require('../controllers/application.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

router.post('/', verifyToken, submitApplication);
router.get('/my', verifyToken, getMyApplications);
router.get('/all', verifyToken, requireRole('admin', 'officer'), getAllApplications);
router.put('/:id/status', verifyToken, requireRole('admin', 'officer'), updateApplicationStatus);

module.exports = router;

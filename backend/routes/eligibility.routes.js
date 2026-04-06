const express = require('express');
const router = express.Router();
const { checkEligibility, getMyResults, checkAllPrograms } = require('../controllers/eligibility.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/check', verifyToken, checkEligibility);
router.post('/check-all', verifyToken, checkAllPrograms);
router.get('/results', verifyToken, getMyResults);

module.exports = router;

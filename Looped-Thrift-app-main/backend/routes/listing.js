const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fakeListingController = require('../controllers/fakeListingController');

router.post('/analyse', auth, fakeListingController.analyseBeforeUpload);

module.exports = router;

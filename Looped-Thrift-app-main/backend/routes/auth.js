const router = require('express').Router();
const { signup, verifyOtp, login, resendOtp } = require('../controllers/authController');

router.post('/signup',     signup);
router.post('/verify-otp', verifyOtp);
router.post('/login',      login);
router.post('/resend-otp', resendOtp);

module.exports = router;

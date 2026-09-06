const router = require('express').Router();
const { styleMeQuery } = require('../controllers/styleMeController');

// POST /style-me — AI personal stylist query
// Auth is optional — works for guests too, but can be extended with auth middleware later
router.post('/', styleMeQuery);

module.exports = router;

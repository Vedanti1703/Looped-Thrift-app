const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rentalController = require('../controllers/rentalController');

router.post('/estimate', rentalController.getRentEstimate);
router.get('/feed', rentalController.getRentableFeed);

router.post('/list', auth, rentalController.listForRent);
router.post('/request', auth, rentalController.requestRental);
router.post('/:id/return-request', auth, rentalController.requestReturn);
router.post('/:id/confirm-return', auth, rentalController.confirmReturn);
router.post('/:id/dispute', auth, rentalController.raiseDispute);
router.get('/my-rentals', auth, rentalController.getMyRentals);
router.get('/my-listings', auth, rentalController.getMyRentalListings);

module.exports = router;

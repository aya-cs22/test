const express = require('express');
const { initiatePayment } = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-payment', initiatePayment);

module.exports = router;
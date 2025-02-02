const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    amountCents: { type: Number, required: true },
    billingData: { type: Object, required: true },
    paymentKey: { type: String, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

// Use paymentSchema instead of PaymentSchema
paymentSchema.pre('save', async function (next) {
  this.updated_at = Date.now(); // Ensure you have an updated_at field in your schema if you want to use this
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
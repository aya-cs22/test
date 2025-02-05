const axios = require('axios');
const { PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID } = require('../config/db');

exports.getAuthToken = async () => {
    try {
        const response = await axios.post('https://accept.paymob.com/api/auth/tokens', {
            api_key: PAYMOB_API_KEY
        });
        return response.data.token;
    } catch (error) {
        console.error('Error getting auth token:', error.response ? error.response.data : error.message);
        throw error;
    }
};

exports.createOrder = async (authToken, amountCents) => {
    try {
        const response = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
            auth_token: authToken,
            delivery_needed: "false",
            amount_cents: amountCents,
            currency: "EGP",
            items: []
        });
        return response.data.id;
    } catch (error) {
        console.error('Error creating order:', error.response ? error.response.data : error.message);
        throw error;
    }
};

exports.getPaymentKey = async (authToken, orderId, amountCents, billingData) => {
    try {
        const response = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
            auth_token: authToken,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: orderId,
            billing_data: billingData,
            currency: "EGP",
            integration_id: PAYMOB_INTEGRATION_ID
        });
        return response.data.token;
    } catch (error) {
        console.error('Error getting payment key:', error.response ? error.response.data : error.message);
        throw error;
    }
};
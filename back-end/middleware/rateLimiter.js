const rateLimit = require('express-rate-limit');
function createRateLimiter(maxAttempts, wiindowMs) {
    return rateLimit({
        wiindowMs,
        max: maxAttempts,
        message: `Too many requests, please try again later.`
    });
}

module.exports = createRateLimiter;
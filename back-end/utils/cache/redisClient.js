// utils/cache/redisClient.js
require('dotenv').config();  // علشان تقرأ من ملف .env
const redis = require('redis');

// تهيئة العميل
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
});

redisClient.on('connect', () => {
    console.log('Connected to Redis successfully');
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

module.exports = redisClient;

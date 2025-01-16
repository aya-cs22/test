// utils/cacheHelpers.js

const client = require('./redisClient');

// دالة لتخزين البيانات في الكاش مع تحديد وقت انتهاء (expire)
const setCache = (key, value, ttl = 3600) => {
  client.setex(key, ttl, JSON.stringify(value), (err, reply) => {
    if (err) {
      console.error('Error setting cache:', err);
    } else {
      console.log('Cache set for key:', key);
    }
  });
};

// دالة لاسترجاع البيانات من الكاش
const getCache = (key) => {
  return new Promise((resolve, reject) => {
    client.get(key, (err, data) => {
      if (err) {
        reject(err);
      } else {
        if (data) {
          resolve(JSON.parse(data)); // تحويل البيانات إلى JSON
        } else {
          resolve(null); // إذا لم يتم العثور على الكاش
        }
      }
    });
  });
};

// دالة لحذف الكاش
const deleteCache = (key) => {
  client.del(key, (err, response) => {
    if (err) {
      console.error('Error deleting cache:', err);
    } else {
      console.log(`Cache deleted for key: ${key}`);
    }
  });
};

module.exports = { setCache, getCache, deleteCache };

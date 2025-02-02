const mongoose = require('mongoose');
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID ;

const dbConnection = async (retries = 10) => {
  while (retries) {
    try {
      console.log('Connecting to DB:', process.env.DB_URI);
      await mongoose.connect(process.env.DB_URI, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
      });
      console.log('Database connected successfully');
      break;
    } catch (error) {
      console.error('Database connection error:', error.message || error);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      if (retries === 0) throw new Error('Failed to connect to database');
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

module.exports = {
  PAYMOB_API_KEY,
  PAYMOB_INTEGRATION_ID,
  dbConnection
};
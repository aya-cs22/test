const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss');
dotenv.config({ path: 'config.env' });
const dbConnection = require('./config/db.js');
const userController = require('./controllers/userController.js');
const cron = require('node-cron');
const Groups = require('./models/groups.js');
const validator = require('validator');
const cookieParser = require('cookie-parser');

const redisClient = require('./utils/cache/redisClient'); 
// Connect with DB
dbConnection();

// express app
const app = express();

// middlewares
app.use(cors());
// {
//     origin: 'https://code-eagles.vercel.app'
// }
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
    console.log(`mode: ${process.env.NODE_ENV}`);
}

// Routes
const userRoutes = require('./routes/userRoutes.js');
const groupsRoutes = require('./routes/groupsRoutes.js');
const lectureRoutes = require('./routes/lectureRoutes.js');
const contactusRoutes = require('./routes/ContactMessageRoutes.js');

app.use('/api/users', userRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/contact', contactusRoutes);

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

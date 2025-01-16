const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authenticate')
const ContactMessageController = require('../controllers/ContactMessageController');
// contact-us
router.post('/contact-us', ContactMessageController.contact_us);
router.get('/contact-us/messages', authMiddleware, ContactMessageController.get_all_messages);
router.post('/contact-us/reply', authMiddleware, ContactMessageController.reply_to_message);

module.exports = router; 
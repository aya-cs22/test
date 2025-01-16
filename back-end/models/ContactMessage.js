const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        maxlength: [50, 'Name cannot be longer than 50 characters'], 
    },
    email: {
        type: String,
        required: true,
        maxlength: [100, 'Email cannot be longer than 100 characters'],
    },
    message: {
        type: String,
        required: true,
    },
    adminReply: {
        type: String,
        default: '',
    },
    isReplied: {
        type: Boolean,
        default: false,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
      },
});

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
module.exports = ContactMessage;
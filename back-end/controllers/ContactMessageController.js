const ContactMessage = require("../models/ContactMessage");
const transporter = require('../config/mailConfig');

// contact-us
exports.contact_us = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const contactMessage = new ContactMessage({
            name: name,
            email: email,
            message: message,
        });

        await contactMessage.save();

        const mailOptions = {
            from: email,
            to: process.env.ADMIN_EMAIL,
            subject: 'New Contact Us Message',
            text: `You have received a new message from:
                   \nName: ${name}
                   \nEmail: ${email}
                   \nMessage: ${message}`,
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('Email sent: ' + info.response);

        return res.status(200).json({ message: 'Message sent successfully' });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};




exports.get_all_messages = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied, only admins can view messages.' });
        }

        const messages = await ContactMessage.find();

        if (messages.length === 0) {
            return res.status(404).json({ message: 'No messages found' });
        }

        return res.status(200).json({ messages: messages });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


exports.reply_to_message = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied, only admins can reply to messages.' });
        }

        const { messageId, adminReply } = req.body;

        if (!messageId || !adminReply) {
            return res.status(400).json({ message: 'Message ID and admin reply are required' });
        }

        const message = await ContactMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        message.adminReply = adminReply;
        message.isReplied = true;
        await message.save();

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: message.email,
            subject: 'Reply to Your Message',
            text: `Dear ${message.name},\n\n${adminReply}\n\nBest regards,\nAdmin`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);

        return res.status(200).json({ message: 'Reply sent successfully and email sent to the user', message });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
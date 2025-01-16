const transporter = require('../config/mailConfig');
const xss = require('xss');

const jwt = require('jsonwebtoken');
const User = require('../models/users');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Groups = require('../models/groups');
const Lectures = require('../models/lectures');
const authMiddleware = require('../middleware/authenticate')
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
// const redisClient = require('../utils/cache/redisClient'); 
// Import FingerprintJS
const FingerprintJS = require('@fingerprintjs/fingerprintjs');

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '3h' }
    );
};

const EMAIL_VERIFICATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes 



const escapeHtml = (str) => {
    return str.replace(/[&<>"'/]/g, (match) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;',
        };
        return map[match];
    });
};


// Function to generate a 6-digit verification code
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};






// // register user
// exports.register = async (req, res) => {
//     await body('email').isEmail().withMessage('Invalid email format').run(req);
//     await body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters long').run(req);
//     await body('phone_number').isMobilePhone().withMessage('Invalid phone number').run(req);
//     await body('name').isLength({ min: 3 }).withMessage('Name must be at least 3 characters long').run(req); // Name validation

//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//     }

//     try {
//         let { name, email, password, phone_number, fingerprint } = req.body;
//         name = escapeHtml(name);
//         email = escapeHtml(email);
//         phone_number = escapeHtml(phone_number);
//         password = escapeHtml(password);
//         // Check if the user exists
//         let user = await User.findOne({ email });
//         // let token;
//         if (user) {
//             if (user.isVerified) {
//                 return res.status(400).json({ message: 'User already exists and is verified' });
//             } else {
//                 user.emailVerificationCode = generateVerificationCode();
//                 user.verificationCodeExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TIMEOUT);
//                 // token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '10m' });
//                 const token = jwt.sign(
//                     { id: user._id, role: user.role },
//                     process.env.JWT_SECRET,
//                     { expiresIn: '3h' }
//                 );
//                 user.lastToken = token;
//                 await user.save();

//                 const mailOptions = {
//                     from: process.env.ADMIN_EMAIL,
//                     to: user.email,
//                     subject: '🔑 Email Verification Code from Code Eagles',
//                     html: `
//                       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
//                         <header style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
//                           <h1 style="margin: 0; font-size: 24px;">Welcome to Code Eagles! 🦅</h1>
//                         </header>
//                         <div style="padding: 20px; background-color: #f9f9f9;">
//                           <h2 style="font-size: 20px; color: #333;">Hello, ${user.name}!</h2>
//                           <p style="color: #555;">To complete your registration, please verify your email address using the code below:</p>
//                           <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #e1f5e1; border: 1px solid #ddd; border-radius: 5px;">
//                             <p style="font-size: 1.5em; font-weight: bold; color: #4CAF50;">${user.emailVerificationCode}</p>
//                           </div>
//                           <p style="color: #555;">This code is valid for the next 10 minutes. If you didn’t request this email, please ignore it.</p>
//                           <p style="margin-top: 20px; color: #555;">Happy Coding!<br>The Code Eagles Team</p>
//                         </div>
//                         <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
//                           <p>If you have any issues, feel free to <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50;">contact us</a>.</p>
//                         </footer>
//                       </div>
//                     `
//                 };


//                 // res.cookie('token', token, {
//                 //     httpOnly: true,
//                 //     // secure: process.env.NODE_ENV === 'production',
//                 //     secure: false,
//                 //     maxAge: 10 * 60 * 1000,
//                 // });
//                 await transporter.sendMail(mailOptions);
//                 return res.status(200).json({ message: 'Verification code resent. Please verify your email.', token });
//             }
//         }

//         const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user';





//         // Create a new user instance
//         const newUser = new User({
//             name,
//             email,
//             phone_number,
//             password,
//             isVerified: false,
//             groupId: [],
//             emailVerificationCode: generateVerificationCode(),
//             verificationCodeExpiry: new Date(Date.now() + EMAIL_VERIFICATION_TIMEOUT),
//             fingerprint
//         });
//         // token = jwt.sign({ id: newUser._id, email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '10m' });
     
//         newUser.lastToken = token;
//         console.log(newUser);
//         await newUser.save();

//         // Send verification email
//         const mailOptions = {
//             from: process.env.ADMIN_EMAIL,
//             to: newUser.email,
//             subject: '🔑 Email Verification Code from Code Eagles',
//             html: `
//               <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
//                 <header style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
//                   <h1 style="margin: 0; font-size: 24px;">Welcome to Code Eagles! 🦅</h1>
//                 </header>
//                 <div style="padding: 20px; background-color: #f9f9f9;">
//                   <h2 style="font-size: 20px; color: #333;">Hello, ${newUser.name}!</h2>
//                   <p style="color: #555;">To complete your registration, please verify your email address using the code below:</p>
//                   <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #e1f5e1; border: 1px solid #ddd; border-radius: 5px;">
//                     <p style="font-size: 1.5em; font-weight: bold; color: #4CAF50;">${newUser.emailVerificationCode}</p>
//                   </div>
//                   <p style="color: #555;">This code is valid for the next 10 minutes. If you didn’t request this email, please ignore it.</p>
//                   <p style="margin-top: 20px; color: #555;">Happy Coding!<br>The Code Eagles Team</p>
//                 </div>
//                 <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
//                   <p>If you have any issues, feel free to <a href="codeeagles653@gmail.com" style="color: #4CAF50;">contact us</a>.</p>
//                 </footer>
//               </div>
//             `
//         };

//         await transporter.sendMail(mailOptions);
//         // res.cookie('token', token, {
//         //     httpOnly: true,
//         //     // secure: process.env.NODE_ENV === 'production',
//         //     secure:false,
//         //     maxAge: 10 * 60 * 1000,
//         // });
//         res.status(200).json({ message: 'Registration successful, please verify your email', token });
//     } catch (error) {
//         console.error('Registration error:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };


exports.register = async (req, res) => {
    await body('email').isEmail().withMessage('Invalid email format').run(req);
    await body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters long').run(req);
    await body('phone_number').isMobilePhone().withMessage('Invalid phone number').run(req);
    await body('name').isLength({ min: 3 }).withMessage('Name must be at least 3 characters long').run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        let { name, email, password, phone_number, fingerprint } = req.body;
        name = escapeHtml(name);
        email = escapeHtml(email);
        phone_number = escapeHtml(phone_number);
        password = escapeHtml(password);

        // Check if the user exists
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                return res.status(400).json({ message: 'User already exists and is verified' });
            } else {
                user.emailVerificationCode = generateVerificationCode();
                user.verificationCodeExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TIMEOUT);

                const token = jwt.sign(
                    { id: user._id, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: '10m' }
                );
                user.lastToken = token;
                await user.save();

                const mailOptions = {
                    from: process.env.ADMIN_EMAIL,
                    to: user.email,
                    subject: '🔑 Email Verification Code from Code Eagles',
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        <header style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
                          <h1 style="margin: 0; font-size: 24px;">Welcome to Code Eagles! 🦅</h1>
                        </header>
                        <div style="padding: 20px; background-color: #f9f9f9;">
                          <h2 style="font-size: 20px; color: #333;">Hello, ${user.name}!</h2>
                          <p style="color: #555;">To complete your registration, please verify your email address using the code below:</p>
                          <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #e1f5e1; border: 1px solid #ddd; border-radius: 5px;">
                            <p style="font-size: 1.5em; font-weight: bold; color: #4CAF50;">${user.emailVerificationCode}</p>
                          </div>
                          <p style="color: #555;">This code is valid for the next 10 minutes. If you didn’t request this email, please ignore it.</p>
                          <p style="margin-top: 20px; color: #555;">Happy Coding!<br>The Code Eagles Team</p>
                        </div>
                        <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
                          <p>If you have any issues, feel free to <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50;">contact us</a>.</p>
                        </footer>
                      </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                return res.status(200).json({ message: 'Verification code resent. Please verify your email.', token });
            }
        }

        const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
        // Create a new user instance
        const newUser = new User({
            name,
            email,
            phone_number,
            password,
            isVerified: false,
            groupId: [],
            emailVerificationCode: generateVerificationCode(),
            verificationCodeExpiry: new Date(Date.now() + EMAIL_VERIFICATION_TIMEOUT),
            fingerprint
        });

        // Generate token for the new user
        const token = jwt.sign(
            { id: newUser._id, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );

        newUser.lastToken = token;
        console.log(newUser);
        await newUser.save();

        // Send verification email
        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: newUser.email,
            subject: '🔑 Email Verification Code from Code Eagles',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <header style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
                  <h1 style="margin: 0; font-size: 24px;">Welcome to Code Eagles! 🦅</h1>
                </header>
                <div style="padding: 20px; background-color: #f9f9f9;">
                  <h2 style="font-size: 20px; color: #333;">Hello, ${newUser.name}!</h2>
                  <p style="color: #555;">To complete your registration, please verify your email address using the code below:</p>
                  <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #e1f5e1; border: 1px solid #ddd; border-radius: 5px;">
                    <p style="font-size: 1.5em; font-weight: bold; color: #4CAF50;">${newUser.emailVerificationCode}</p>
                  </div>
                  <p style="color: #555;">This code is valid for the next 10 minutes. If you didn’t request this email, please ignore it.</p>
                  <p style="margin-top: 20px; color: #555;">Happy Coding!<br>The Code Eagles Team</p>
                </div>
                <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
                  <p>If you have any issues, feel free to <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50;">contact us</a>.</p>
                </footer>
              </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Registration successful, please verify your email', token });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


exports.verifyEmail = async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Access denied. ' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        if (user.email !== email) {
            return res.status(400).json({ message: 'Email does not match the logged in user' });
        }

        if (!user.emailVerificationCode || user.emailVerificationCode !== code || new Date() > user.verificationCodeExpiry) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        user.isVerified = true;
        user.emailVerificationCode = null;
        user.verificationCodeExpiry = null;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully' });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                message: 'Your token has expired. Please request a new verification token.'
            });
        }
        console.error('Error verifying email: ', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// forget password

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate a 6-digit code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordToken = resetCode;
        user.resetPasswordExpiry = Date.now() + 6000000; // 10 minutes
        // const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        //     expiresIn: '5m'
        // });
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
        user.resetPasswordJWT = token;
        user.lastToken = token;
        console.log(token);
        await user.save();

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: user.email,
            subject: 'Reset Password',
            html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
        <header style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Code Eagles Password Reset</h1>
        </header>
        <div style="padding: 20px;">
            <h2 style="font-size: 20px; color: #333;">Hello, ${user.name}!</h2>
            <p style="color: #555;">We received a request to reset your password. Use the code below to reset it:</p>
            <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 5px;">
                <p style="font-size: 2em; font-weight: bold; color: #4CAF50;">${resetCode}</p>
            </div>
            <p style="color: #555;">This code is valid for the next <strong>3 minutes</strong>. If you did not request this reset, please ignore this email or contact support if you have any concerns.</p>
            <p style="margin-top: 20px; color: #555;">Best Regards,<br>The Code Eagles Team</p>
        </div>
        <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
            <p style="margin: 0;">Need help? Contact us at <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50; text-decoration: none;">codeeagles653@gmail.com</a></p>
        </footer>
    </div>
    `
        };
        // res.cookie('token', token, {
        //     httpOnly: true,
        //     // secure: process.env.NODE_ENV === 'production',
        //     secure:false,
        //     maxAge: 10 * 60 * 1000,
        // });
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Reset password email sent', token });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                message: 'Your token has expired. Please request a new verification token.'
            });
        }
        console.error('Error sending reset password email:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// // update password without token
// exports.resetPassword = async (req, res) => {
//     try {
//         const { resetCode, newPassword } = req.body;
//         if (!newPassword || newPassword.length < 10) {
//             return res.status(400).json({ message: 'New password must be at least 10 characters long' });
//         }
//         const user = await User.findOne({
//             resetPasswordToken: resetCode,
//             resetPasswordExpiry: { $gt: Date.now() }
//         });

//         if (!user) {
//             return res.status(400).json({ message: 'Invalid or expired code' });
//         }

//         user.password = newPassword;
//         user.resetPasswordToken = undefined;
//         user.resetPasswordExpiry = undefined;
//         user.tokenVersion += 1;
//         await user.save();

//         res.status(200).json({ message: 'Password has been reset successfully' });
//     } catch (error) {
//         console.error('Error resetting password:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };




exports.resetPassword = async (req, res) => {
    try {

        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        const { resetCode, newPassword } = req.body;
        if (!newPassword || newPassword.length < 10) {
            return res.status(400).json({ message: 'New password must be at least 10 characters long' });
        }

        const validUser = await User.findOne({
            resetPasswordToken: resetCode,
            resetPasswordExpiry: { $gt: Date.now() }
        });

        if (!validUser || validUser.id !== user.id) {
            return res.status(400).json({ message: 'Invalid or expired code, or user mismatch' });
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        user.tokenVersion += 1;
        await user.save();

        res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                message: 'Your token has expired. Please request a new verification token.'
            });
        }
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};




exports.login = async (req, res) => {
    const { email, password, fingerprint } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Email not found. Please register first.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email first' });
        }

        if (!user.fingerprint) {
            user.fingerprint = fingerprint; 
            
            const token = jwt.sign(
                { id: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '3h' }
            );
            user.lastToken = token; 
        
            await user.save(); 
            return res.status(200).json({
                message: 'Login successful. Fingerprint saved for future logins.',
                token,  
            });
        }
        

        if (user.role !== 'admin' && user.fingerprint !== fingerprint) {
            return res.status(400).json({ message: 'Fingerprint mismatch. Login denied.' });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );
        user.lastToken = token; 
        await user.save(); 
        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



exports.addUser = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const { name, email, password, phone_number, role, groupId } = req.body;

        if (!name || !email || !password || !phone_number || !role) {
            return res.status(400).json({ message: 'All fields except groupId are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        let group;
        if (groupId) {
            group = await Groups.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: 'Group not found' });
            }
        }

        await session.startTransaction();

        const newUser = new User({
            name: xss(name),
            email: xss(email),
            password: password,
            phone_number: xss(phone_number),
            role: xss(role),
            isVerified: true,
            groups: group
                ? [
                    {
                        groupId: groupId,
                        status: 'approved',
                        attendancePercentage: 0,
                        totalAttendance: 0, 
                        totalAbsence: 0, 
                    },
                ]
                : [],
        });

        await newUser.save({ session });

        if (group) {
            group.members.push({ user_id: newUser._id });
            await group.save({ session });

            const lectures = await Lectures.find({ group_id: groupId });

            let totalAbsence = 0;
            const attendance = lectures.map((lecture) => {
                totalAbsence += 1;
                return {
                    lectureId: lecture._id,
                    attendanceStatus: 'absent',
                    attendedAt: null,
                };
            });

            const totalLectures = lectures.length;
            const totalAttendance = totalLectures - totalAbsence;
            const attendancePercentage = totalLectures > 0
                ? ((totalAttendance / totalLectures) * 100).toFixed(2)
                : '0.00';

            newUser.groups[0].attendance = attendance;
            newUser.groups[0].totalAbsence = totalAbsence;
            newUser.groups[0].totalAttendance = totalAttendance;
            newUser.groups[0].attendancePercentage = attendancePercentage;

            await newUser.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ message: 'User added successfully', user: newUser });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        console.error('Error adding user: ', error);
        res.status(500).json({ message: 'Server error' });
    }
};







// get user by token
exports.getUserByhimself = async (req, res) => {
    try {
        const userIdFromToken = req.user.id;
        const user = await User.findById(userIdFromToken);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userResponse = { ...user._doc, password: undefined };

        res.status(200).json(userResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// get user by id
exports.getUserByid = async (req, res) => {
    try {
        const { id } = req.params;
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user.id !== id && !(req.user.role === 'admin')) {
            return res.status(403).json({ message: 'Access denied' });
        }


        let userResponse;

        if (req.user.role === 'admin') {
            userResponse = { ...user._doc, password: undefined };
        } else if (req.user.id === id) {
            userResponse = { ...user._doc };
        }

        res.status(200).json(userResponse);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// get all user
exports.getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};





// exports.getAllUsers = async (req, res) => {
//     try {
//         if (req.user.role !== 'admin') {
//             return res.status(403).json({ message: 'Access denied' });
//         }

//         if (!redisClient.isOpen) {
//             await redisClient.connect(); 
//         }

//         const cachedUsers = await redisClient.get('all_users');

//         if (cachedUsers) {
//             console.log('Returning data from Redis');
//             return res.status(200).json(JSON.parse(cachedUsers));
//         }

//         const users = await User.find().select('-password');
        
//         await redisClient.set('all_users', JSON.stringify(users), { EX: 3600 }); 
//         console.log('Returning data from MongoDB');
        
//         res.status(200).json(users);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };








exports.getPendingUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const users = await User.find({
            "groups.status": "pending"
        }).select('-password');

        if (users.length === 0) {
            return res.status(404).json({ message: 'No pending users found' });
        }

        const pendingUsersData = [];

        for (const user of users) {
            const pendingGroups = user.groups.filter(group => group.status === 'pending');

            for (const group of pendingGroups) {
                const groupDetails = await Groups.findById(group.groupId).select('title start_date');

                if (groupDetails) {
                    pendingUsersData.push({
                        groupId: group.groupId,
                        groupName: groupDetails.title,
                        userId: user._id,
                        email: user.email,
                        userName: user.name,
                        start_date: groupDetails.start_date
                    });
                }
            }
        }

        if (pendingUsersData.length === 0) {
            return res.status(404).json({ message: 'No pending group requests found' });
        }

        res.status(200).json(pendingUsersData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


//update user by himself

exports.updateUser = async (req, res) => {
    try {
        const { name, email, password, phone_number } = req.body;
        const userIdFromToken = req.user.id;
        const updates = {};

        const userFromDb = await User.findById(userIdFromToken);
        if (!userFromDb) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) updates.name = name;

        if (email && email !== userFromDb.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already exists, please use a different email' });
            }
            updates.email = email;
        }

        if (password) {
            if (password.length < 10) {
                return res.status(400).json({ message: 'Password must be at least 10 characters' });
            }
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(password, salt);
        }

        if (phone_number) updates.phone_number = phone_number;

        const updatedUser = await User.findByIdAndUpdate(userIdFromToken, updates, { new: true });
        if (!updatedUser) {
            return res.status(400).json({ message: 'Failed to update user' });
        }

        console.log('User updated successfully:', updatedUser);
        return res.status(200).json({ message: 'User updated successfully', user: updatedUser });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


// update role user by admin
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const userIdFromToken = req.user.id;
        const userIdToUpdate = req.params.id;

        console.log('Admin User ID from Token:', userIdFromToken);
        console.log('User ID to Update Role:', userIdToUpdate);

        const userRoleFromToken = req.user.role;
        if (userRoleFromToken !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Only admin can update role.' });
        }

        const userFromDb = await User.findById(userIdToUpdate);
        if (!userFromDb) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (role) {
            userFromDb.role = role;
            await userFromDb.save();
            console.log('User role updated successfully:', userFromDb);

            return res.status(200).json({
                message: 'User role updated successfully',
                user: userFromDb
            });
        } else {
            return res.status(400).json({ message: 'Role is required to update' });
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};




exports.deleteUser = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const { id } = req.params;
        const userIdFromToken = req.user.id;
        const userIdToDelete = id || userIdFromToken;

        // التأكد من صلاحيات المستخدم
        if (req.user.role !== 'admin' && !id) {
            if (userIdFromToken !== userIdToDelete) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        // التحقق من وجود المستخدم
        const user = await User.findById(userIdToDelete).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'User not found' });
        }

        // تحديث المجموعات وحذف المستخدم من قائمة الأعضاء
        await Groups.updateMany(
            { "members.user_id": userIdToDelete },
            { $pull: { members: { user_id: userIdToDelete } } },
            { session }
        );

        // تحديث المحاضرات وحذف المستخدم من المهام
        await Lectures.updateMany(
            { "tasks.submissions.userId": userIdToDelete },
            { $pull: { "tasks.$[].submissions": { userId: userIdToDelete } } },
            { session }
        );

        // تحديث الحضور وحذف المستخدم من قائمة الحضور
        await Lectures.updateMany(
            { "attendees.userId": userIdToDelete },
            { $pull: { attendees: { userId: userIdToDelete } } },
            { session }
        );

        // حذف المستخدم من قاعدة البيانات
        await User.findByIdAndDelete(userIdToDelete).session(session);

        // إنهاء الجلسة بنجاح
        await session.commitTransaction();

        return res.status(200).json({ 
            message: 'User successfully deleted and removed from all groups, lectures, and submissions' 
        });

    } catch (error) {
        // التراجع عن الجلسة في حالة وجود خطأ
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error('Error deleting user: ', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        // إنهاء الجلسة
        session.endSession();
    }
};



exports.submitFeedback = async (req, res) => {
    const { feedback } = req.body;

    if (!feedback) {
        return res.status(400).json({ message: 'Feedback is required' });
    }

    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.feedback = feedback;
        await user.save();

        res.status(200).json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


// get All Feedback
exports.getAllFeedback = async (req, res) => {
    try {
        const users = await User.find({ 'feedback': { $exists: true } });
        if (users.length === 0) {
            return res.status(404).json({ message: 'No feedback found' });
        }

        const feedbacks = users.map(user => ({
            email: user.email,
            name: user.name,
            feedback: user.feedback,
            userId: user._id
        }));

        res.status(200).json({ feedbacks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


exports.deleteFeedback = async (req, res) => {
    const { userId } = req.params;

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only admins can delete feedback' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.feedback = undefined;
        await user.save();

        res.status(200).json({ message: 'Feedback deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};



// exports.addAllowedEmails = async (req, res) => {
//     try {

//         const { groupId, allowedEmails } = req.body;
//         const adminId = req.user.id;

//         const adminUser = await User.findById(adminId);
//         if (adminUser.role !== 'admin') {
//             return res.status(403).json({ message: 'Access denied: Only admins can perform this action' });
//         }

//         const group = await Groups.findById(groupId);
//         if (!group) {
//             return res.status(404).json({ message: 'Group not found' });
//         }

//         group.allowedEmails = group.allowedEmails || [];

//         for (const email of allowedEmails) {
//             const userExists = await User.findOne({ email });
//             if (!userExists) {
//                 return res.status(400).json({ message: `Email ${email} does not exist in the database` });
//             }
//         }

//         const uniqueEmailsToAdd = allowedEmails.filter(email => !group.allowedEmails.includes(email));
//         if (uniqueEmailsToAdd.length === 0) {
//             return res.status(400).json({ message: 'All emails are already added to this group' });
//         }

//         group.allowedEmails.push(...uniqueEmailsToAdd);
//         await group.save();

//         return res.status(200).json({
//             message: 'Allowed emails added successfully',

//             allowedEmails: group.allowedEmails
//         });
//     } catch (error) {
//         console.error('Error adding allowed emails:', error);
//         return res.status(500).json({ message: 'Server error' });
//     }
// };

exports.addAllowedEmails = async (req, res) => {
    try {
        const { groupId, allowedEmails } = req.body;
        const adminId = req.user.id;

        const adminUser = await User.findById(adminId);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only admins can perform this action' });
        }

        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        group.allowedEmails = group.allowedEmails || [];

        const emailsArray = typeof allowedEmails === 'string' ? allowedEmails.split(',') : allowedEmails;

        // for (const email of emailsArray) {
        //     const userExists = await User.findOne({ email: email.trim() });
        //     if (!userExists) {
        //         return res.status(400).json({ message: `Email ${email} does not exist in the database` });
        //     }
        // }

        const uniqueEmailsToAdd = emailsArray.filter(email => !group.allowedEmails.includes(email.trim()));
        if (uniqueEmailsToAdd.length === 0) {
            return res.status(400).json({ message: 'All emails are already added to this group' });
        }

        group.allowedEmails.push(...uniqueEmailsToAdd.map(email => email.trim()));
        await group.save();

        return res.status(200).json({
            message: 'Allowed emails added successfully',
            allowedEmails: group.allowedEmails
        });
    } catch (error) {
        console.error('Error adding allowed emails:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


exports.getAllowedEmails = async (req, res) => {
    try {
        console.log('Request User:', req.user);
        const adminId = req.user.id;

        // التحقق من أن المستخدم هو admin
        const adminUser = await User.findById(adminId);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only admins can perform this action' });
        }

        // الحصول على جميع المجموعات
        const groups = await Groups.find().select('title type_course location start_date allowedEmails');
        if (!groups || groups.length === 0) {
            return res.status(404).json({ message: 'No groups found' });
        }

        console.log('Allowed Emails:', groups);

        let users = [];
        // نمر عبر كل مجموعة للحصول على المستخدمين المقترحين
        for (const group of groups) {
            if (group.allowedEmails && group.allowedEmails.length > 0) {
                // البحث عن المستخدمين الذين لديهم بريد إلكتروني موجود في allowedEmails
                const groupUsers = await User.find({
                    email: { $in: group.allowedEmails },
                }).select('name email phone_number');

                // إضافة كل مستخدم إلى القائمة
                users.push(...groupUsers);
            }
        }

        // إعداد الاستجابة بحيث تحتوي على بيانات كل مجموعة والمستخدمين المرتبطين بكل بريد إلكتروني
        const response = groups.map(group => ({
            groupId: group._id,
            title: group.title,
            type_course: group.type_course,
            location: group.location,
            start_date: group.start_date,
            allowedEmails: group.allowedEmails.map(email => {
                // العثور على المستخدم الذي يطابق البريد الإلكتروني
                const user = users.find(u => u.email === email);
                return {
                    email,
                    user: user || null // إضافة بيانات المستخدم إذا وجد أو null إذا لم يتم العثور على المستخدم
                };
            }),
        }));

        return res.status(200).json({
            message: 'Allowed emails and group details retrieved successfully',
            groups: response,
        });
    } catch (error) {
        console.error('Error retrieving allowed emails and group details:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


exports.updateAllowedEmails = async (req, res) => {
    try {
        const { groupId, allowedEmails } = req.body;
        const adminId = req.user.id;

        //
        const adminUser = await User.findById(adminId);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only admins can perform this action' });
        }

        // العثور على الجروب
        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        for (const email of allowedEmails) {
            const userExists = await User.findOne({ email });
            // if (!userExists) {
            //     return res.status(400).json({ message: `Email ${email} does not exist in the database` });
            // }

            const oldGroup = await Groups.findOne({ allowedEmails: email });
            if (oldGroup && oldGroup._id.toString() !== groupId) {
                oldGroup.allowedEmails = oldGroup.allowedEmails.filter(existingEmail => existingEmail !== email);
                await oldGroup.save();
            }
        }

        group.allowedEmails = allowedEmails;
        await group.save();

        return res.status(200).json({
            message: 'Allowed emails updated successfully',
            allowedEmails: group.allowedEmails
        });
    } catch (error) {
        console.error('Error updating allowed emails:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


exports.removeAllowedEmail = async (req, res) => {
    try {
        const { groupId, allowedEmails } = req.body;
        const adminId = req.user.id;

        const adminUser = await User.findById(adminId);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only admins can perform this action' });
        }

        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        const emailIndex = group.allowedEmails.indexOf(allowedEmails);
        if (emailIndex === -1) {
            return res.status(400).json({ message: 'Email not found in allowedEmails' });
        }

        group.allowedEmails.splice(emailIndex, 1);
        await group.save();

        return res.status(200).json({ message: 'Email removed successfully', allowedEmails: group.allowedEmails });
    } catch (error) {
        console.error('Error removing allowed email:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};






exports.joinGroupRequest = async (req, res) => {
    try {
        const { groupId } = req.body;
        const userId = req.user.id;

        if (!groupId) {
            return res.status(400).json({ message: 'groupId is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Ensure user.groups is always an array
        if (!user.groups) {
            user.groups = [];
        }

        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        if (group.allowedEmails && group.allowedEmails.includes(user.email)) {
            const existingGroup = user.groups.find(group => group.groupId.toString() === groupId);
            if (existingGroup) {
                return res.status(400).json({ message: 'You are already a member of this group.' });
            }

            const joinRequest = {
                groupId: groupId,
                status: 'approved',
            };
            user.groups.push(joinRequest);

            const lectures = await Lectures.find({ group_id: groupId });
            for (const lecture of lectures) {
                const alreadyAttended = user.attendance.some(
                    (att) => att.lectureId.toString() === lecture._id.toString()
                );
                if (!alreadyAttended) {
                    user.attendance.push({
                        lectureId: lecture._id,
                        attendanceStatus: 'absent',
                        attendedAt: null,
                    });
                    user.totalAbsent += 1;
                }
            }

            await user.save();

            group.members.push({ user_id: user._id });

            group.allowedEmails = group.allowedEmails.filter(email => email !== user.email);
            await group.save();

            return res.status(200).json({ message: 'You have been added to the group directly.' });
        } else {
            const existingRequest = user.groups.find(group => group.groupId.toString() === groupId);
            if (existingRequest) {
                if (existingRequest.status === 'pending') {
                    return res.status(400).json({ message: 'You already have a pending request for this group.' });
                } else if (existingRequest.status === 'approved') {
                    return res.status(400).json({ message: 'You are already a member of this group.' });
                } else if (existingRequest.status === 'rejected') {
                    return res.status(400).json({ message: 'Your request to join this group has been rejected.' });
                }
            }

            const joinRequest = {
                groupId: groupId,
                status: 'pending',
            };
            user.groups.push(joinRequest);
            await user.save();

            const adminEmail = process.env.ADMIN_EMAIL;
            const mailOptions = {
                from: user.email,
                to: adminEmail,
                subject: 'New Join Request',
                html: `
                    <p>Hello Admin,</p>
                    <p>The user <strong>${user.name}</strong> (<a href="mailto:${user.email}">${user.email}</a>) has requested to join the group "<strong>${group.title}</strong>".</p>
                    <p>Please review the request and take appropriate action:</p>
                    <div style="display: flex; gap: 10px;">
                        <a href="https://api-codeeagles-cpq8.vercel.app/api/users/accept-join-request" 
                            style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
                            Accept
                        </a>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <a href="https://api-codeeagles-cpq8.vercel.app/api/users/reject-join-request" 
                            style="padding: 10px 15px; background-color: #FF6347; color: white; text-decoration: none; border-radius: 5px;">
                            Reject
                        </a>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, data) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).json({ message: 'Error sending email' });
                }
                console.log('Email sent:', data.response);
            });

            return res.status(200).json({ message: 'Join request sent successfully.' });
        }
    } catch (error) {
        console.error('Error sending join request:', error);
        res.status(500).json({ message: 'Server error' });
    }
};







exports.getPendingJoinRequestsByGroup = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const { groupId } = req.params;

        const usersWithPendingRequests = await User.find({
            "groups.groupId": groupId,
            "groups.status": "pending"
        });

        if (usersWithPendingRequests.length === 0) {
            return res.status(404).json({ message: 'No pending join requests found for this group' });
        }

        const group = await Groups.findById(groupId)
        const pendingRequests = usersWithPendingRequests.map(user => {
            return {
                userId: user._id,
                userName: user.name,
                groupName: group.title,
                groupDate: group.start_date,
                pendingGroups: user.groups.filter(group => group.status === 'pending' && group.groupId.toString() === groupId)
            };
        });

        return res.status(200).json({ pendingRequests });

    } catch (error) {
        console.error('Error in fetching pending join requests:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};



exports.acceptJoinRequest = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        const adminId = req.user.id;

        const adminUser = await User.findById(adminId);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'You do not have permission to perform this action' });
        }

        const user = await User.findById(userId);
        const group = await Groups.findById(groupId);

        if (!user || !group) {
            return res.status(404).json({ message: 'User or Group not found' });
        }

        const userRequest = user.groups.find((g) => g.groupId.toString() === groupId);
        if (!userRequest || userRequest.status !== 'pending') {
            return res.status(400).json({ message: 'No pending request found for this group' });
        }

        userRequest.status = 'approved';

        group.members.push({ user_id: user._id });

        const lectures = await Lectures.find({ group_id: groupId });

        let totalAbsence = 0;
        const attendance = lectures.map((lecture) => {
            totalAbsence += 1;
            return {
                lectureId: lecture._id,
                attendanceStatus: 'absent',
                attendedAt: null,
            };
        });

        const totalLectures = lectures.length;
        const totalAttendance = totalLectures - totalAbsence;
        const attendancePercentage = totalLectures > 0
            ? ((totalAttendance / totalLectures) * 100).toFixed(2)
            : '0.00';

        userRequest.attendance = attendance;
        userRequest.totalAbsence = totalAbsence;
        userRequest.totalAttendance = totalAttendance;
        userRequest.attendancePercentage = attendancePercentage;

        await user.save(); 
        await group.save(); 
        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: user.email,
            subject: '🎉 Your Join Request Has Been Approved!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <header style="background-color: #4CAF50; padding: 20px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">Welcome to the ${group.title} Group!</h1>
                    </header>
                    <div style="padding: 20px; background-color: #f9f9f9;">
                        <h2 style="font-size: 20px; color: #333;">Hello, ${user.name}!</h2>
                        <p style="color: #555;">We are pleased to inform you that your request to join the group <strong>"${group.title}"</strong> has been approved. You are now part of our amazing community!</p>
                        <p style="color: #555;">We are excited to have you on board and look forward to your contributions. If you have any questions or need help, feel free to reach out to us.</p>
                        <p style="margin-top: 20px; color: #555;">Best regards,<br>The Team</p>
                    </div>
                    <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
                        <p style="margin: 0;">Need help? Contact us at <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50; text-decoration: none;">codeeagles653@gmail.com</a></p>
                    </footer>
                </div>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            console.log('Email sent:', info.response);
            return res.status(200).json({ message: 'Join request approved successfully' });
        });
    } catch (error) {
        console.error('Error in accepting join request:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};







exports.rejectJoinRequest = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        const adminId = req.user.id;

        const adminUser = await User.findById(adminId);
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'You do not have permission to perform this action' });
        }

        const user = await User.findById(userId);
        const group = await Groups.findById(groupId);



        if (!user || !group) {
            return res.status(404).json({ message: 'User or Group not found' });
        }

        const userRequest = user.groups.find(group => group.groupId.toString() === groupId);
        if (!userRequest || userRequest.status !== 'pending') {
            return res.status(400).json({ message: 'No pending request found for this group' });
        }

        userRequest.status = 'rejected';

        user.groups = user.groups.filter(group => group.groupId.toString() !== groupId);
        await user.save();

        group.members = group.members.filter(member => member.user_id.toString() !== user._id.toString());
        await group.save();

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: user.email,
            subject: '❌ Your Join Request Has Been Rejected',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <header style="background-color: #FF6347; padding: 20px; text-align: center; color: white;">
                  <h1 style="margin: 0; font-size: 24px;">Your Request Has Been Rejected</h1>
                </header>
                <div style="padding: 20px; background-color: #f9f9f9;">
                  <h2 style="font-size: 20px; color: #333;">Hello, ${user.name}!</h2>
                  <p style="color: #555;">We regret to inform you that your request to join the group <strong>"${group.title}"</strong> has been rejected.</p>
                  <p style="color: #555;">If you have any questions or concerns, please feel free to reach out to us. We are here to assist you.</p>
                  <p style="margin-top: 20px; color: #555;">Best regards,<br>The Team</p>
                </div>
                <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
                <p style="margin: 0;">Need help? Contact us at <a href="mailto:codeeagles653@gmail.com" style="color:  #FF6347; text-decoration: none;">codeeagles653@gmail.com</a></p>

                </footer>
              </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            console.log('Email sent:', info.response);
            return res.status(200).json({ message: 'Join request reject successfully' });
        });


    } catch (error) {
        console.error('Error in rejecting join request:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


exports.leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.body;
        const userId = req.user.id; 

        const user = await User.findById(userId);
        const group = await Groups.findById(groupId);

        if (!user || !group) {
            return res.status(404).json({ message: 'User or Group not found' });
        }

        const userInGroup = group.members.some(member => member.user_id && member.user_id.toString() === user._id.toString());
        if (!userInGroup) {
            return res.status(400).json({ message: 'You are not a member of this group' });
        }

        group.members = group.members.filter(member => member.user_id && member.user_id.toString() !== user._id.toString());
        await group.save();

        user.groups = user.groups.filter(groupItem => groupItem.groupId && groupItem.groupId.toString() !== groupId.toString());

        user.attendance = user.attendance.filter(attendance => attendance.groupId && attendance.groupId.toString() !== groupId.toString());

        user.totalPresent = 0;
        user.totalAbsent = 0;

        await user.save();

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: user.email,
            subject: '🚪 You Have Left the Group',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <header style="background-color: #FF6347; padding: 20px; text-align: center; color: white;">
                  <h1 style="margin: 0; font-size: 24px;">You Have Left the Group</h1>
                </header>
                <div style="padding: 20px; background-color: #f9f9f9;">
                  <h2 style="font-size: 20px; color: #333;">Hello, ${user.name}!</h2>
                  <p style="color: #555;">We have successfully processed your request to leave the group <strong>"${group.title}"</strong>.</p>
                  <p style="color: #555;">If you have any further questions or concerns, feel free to reach out to us. We are here to help.</p>
                  <p style="margin-top: 20px; color: #555;">Best regards,<br>The Team</p>
                </div>
                <footer style="background-color: #f1f1f1; padding: 10px; text-align: center; color: #777; font-size: 14px;">
                  <p style="margin: 0;">Need help? Contact us at <a href="mailto:codeeagles653@gmail.com" style="color:  #FF6347; text-decoration: none;">codeeagles653@gmail.com</a></p>
                </footer>
              </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            console.log('Email sent:', info.response);
            return res.status(200).json({ message: 'You have successfully left the group' });
        });

    } catch (error) {
        console.error('Error in leaving group:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};







exports.setRoleToPending = async (req, res) => {
    try {
        const { userId, groupId } = req.params; 
        const adminId = req.user.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'You do not have permission to perform this action' });
        }

        const group = user.groups.find(g => g.groupId.toString() === groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found in user\'s groups' });
        }

        if (group.status === 'approved' || group.status === 'rejected') {
            group.status = 'pending'; 
        } else {
            return res.status(400).json({ message: 'Group status is not in approved or rejected state' });
        }

        await user.save();

        res.status(200).json({
            message: 'User group status updated to pending',
            group
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user group status', error: error.message });
    }
};


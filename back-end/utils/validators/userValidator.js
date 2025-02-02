const bcrypt = require('bcryptjs');
const { check, body } = require('express-validator');
const User = require('../../models/users');

const userValidator = [
    // email
    check('email')
  .isEmail().withMessage('Please enter a valid email address')
  .normalizeEmail(),
//     // name
  check('name')
  .notEmpty().withMessage('Name is required')
  .isLength({ max: 50 }).withMessage('Name cannot be longer than 50 characters'),

    //password
    check('password')
  .notEmpty().withMessage('Password is required')
  .isLength({ min: 10 }).withMessage('Password should be at least 10 characters long')
  .isLength({ max: 50 }).withMessage('Password cannot be longer than 50 characters'),

  // phone number
  check('phone_number')
  .notEmpty().withMessage('Phone number is required')
  .isLength({ max: 30 }).withMessage('Phone number cannot be longer than 30 characters'),

    check('resetPasswordToken')
      .optional()  
      .isLength({ max: 6 }).withMessage('reset Password Token cannot be longer than 6 characters')
      .isAlphanumeric().withMessage('reset Password Token must be alphanumeric'),
  
    check('emailVerificationCode')
      .optional() 
      .isLength({ max: 6 }).withMessage('email Verification Code cannot be longer than 6 characters')
      .isAlphanumeric().withMessage('email Verification Code must be alphanumeric'),
  ];
module.exports = userValidator;

const bcrypt = require('bcryptjs');
const { check, body } = require('express-validator');
const Lectures = require('../../models/lectures');



const lectureValidator = [
  check('submissions.*.submissionLink')
    .isLength({ min: 30, max: 150 }).withMessage('Google Drive link must be between 30 and 150 characters')
    .matches(/^https?:\/\/drive\.google\.com\/.*$/).withMessage('Google Drive link must be a valid Google Drive link'),
    
    // code
    check('code')
    .notEmpty().withMessage('Code is required')
    .isLength({ min: 6, max: 6 }).withMessage('Code must be exactly 6 characters long')
    .matches(/^[A-Za-z0-9]+$/).withMessage('Code must contain only alphanumeric characters'),

];

module.exports = lectureValidator;


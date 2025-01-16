const jwt = require('jsonwebtoken');
const User = require('../models/users');
const mongoose = require('mongoose'); // لاستعمال ObjectId

const authenticate = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  // const token = req.cookies.token

  if (!token) {
    return res.status(401).json({ message: 'Access denied. ' });
  }

  try {
    // التحقق من التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // // التحقق من صلاحية lastToken
    // if (user.lastToken && user.lastToken !== token) {
    //   return res.status(401).json({ message: 'Token has expired. Please log in again.' });
    // }

    // // التحقق من أن tokenVersion متطابق
    // if (decoded.tokenVersion !== user.tokenVersion) {
    //   return res.status(401).json({ message: 'Token has expired. Please log in again.' });
    // }

    // التحقق من أن resetPasswordExpiry ليس قد انتهى
    if (user.resetPasswordExpiry && Date.now() > user.resetPasswordExpiry) {
      return res.status(401).json({ message: 'Password reset token has expired. Please request a new one.' });
    }

    req.user = {
      id: user._id,
      role: user.role,
      groups: user.groups || [],
    };

    next();
  } catch (error) {
    return res.status(400).json({ message: 'Invalid token.' });
  }
};

module.exports = authenticate;

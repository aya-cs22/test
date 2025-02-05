// const jwt = require('jsonwebtoken');
// const User = require('../models/users');
// const mongoose = require('mongoose');
// const authenticate = async (req, res, next) => {
//   const token = req.header('Authorization')?.replace('Bearer ', '');

//   if (!token) {
//     console.log("No token provided");
//     return res.status(401).json({ message: 'Access denied.' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     console.log("Decoded Token:", decoded); 

//     const user = await User.findById(decoded.id);
//     console.log("User Found:", user);

//     if (!user) {
//       return res.status(401).json({ message: 'User not found.' });
//     }

//     if (user.resetPasswordExpiry && Date.now() > user.resetPasswordExpiry) {
//       return res.status(401).json({ message: 'Password reset token has expired. Please request a new one.' });
//     }

//     req.user = {
//       id: user._id,
//       role: user.role,
//       groups: user.groups || [],
//     };

//     console.log("User Authenticated:", req.user);
//     next();
//   } catch (error) {
//     console.log("Invalid token:", error.message);
//     return res.status(400).json({ message: 'Invalid token.' });
//   }
// };

// module.exports = authenticate;
const jwt = require('jsonwebtoken');
const User = require('../models/users');
const asyncHandler = require('express-async-handler');

const authenticate = asyncHandler(async(req, res, next) =>{
    const token = req.header('Authorization')?.replace('Bearer ', '');
    // check the token is in the header
    if(token){
        try{
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

            const user = await User.findById(decoded.userId).select('-password');
            console.log(token)

            if(!user){
                return res.status(401).json({message: "Unauthorized: User not found"});
            }
            req.user = user;
            next();
        } catch(error){
            console.error("error virification token", error.message);
            return res.status(401).json({message: "Unauthorized: Invalid Token"});
        }
    } else{
        // console.log(token)
        return res.status(401).json({message: "Unauthorized: Invalid Token"});
    }
});
module.exports = authenticate

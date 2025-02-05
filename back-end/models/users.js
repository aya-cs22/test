const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const xss = require('xss');

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    minlength:[3, 'Name cannot be smaller than 3 characters'],
    maxlength: [50, 'Name cannot be longer than 50 characters'], 
  },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,

    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please enter a valid email'
    ]
    
  },
  password: {
    type: String,
    required: true,
    minlength: [10, 'too short password'],
  },

  isVerified: {
    type: Boolean,
    default: false // user need to virify your email
  },

  phone_number: {
    type: String,
    required: true,
    maxlength: [30, 'Phone number cannot be longer than 30 characters'],
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: function () {
      return this.email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
    }
  },

  googleLogin: {
    type: Boolean,
    default: false,
  },

  groups: [
    {
      groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'special'],
        default: 'pending',
      },
      requestType: { 
        type: String,
        enum: ['join', 'invite'], 
        default: 'join', 
      },
      note:{
        type:String,
      },
      attendance: [
        {
          lectureId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lectures',
            required: true
          },
          attendanceStatus: {
            type: String,
            enum: ['present', 'absent'],
            default: 'absent',
          },
          attendedAt: {
            type: Date,
            default: null
          }
        }
      ],

      lecturesSpecial: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Lectures', 
        }
      ],

      totalAttendance: {
        type: Number,
        default: 0,
      },
      totalAbsence: {
        type: Number,
        default: 0,
      },

      attendancePercentage: {
        type: Number,
        default: 0, 
      },
      tasks: [ // Adding tasks inside the group
        {
          taskId: mongoose.Schema.Types.ObjectId,
          taskName: String,
          submissionLink: String,
          submittedOnTime: Boolean,
          submittedAt: Date,
          score: Number,
          feedback: String,
        },
      ],
      totalScore: {
        type: Number,
        default: 0, 
      },
    }
  ],

  feedback: { type: String },

  emailVerificationCode: {
    type: String,
    default: null,
    minlength: [6, 'email Verification Code cannot be smaller than 6 characters'],
    maxlength: [6, 'email Verification Code cannot be longer than 6 characters'],
  },
  verificationCodeExpiry: { // Verification code expiration date
    type: Date,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null,
    minlength: [6, 'reset Password Token cannot be smaller than 6 characters'],
    maxlength: [6, 'reset Password Token cannot be longer than 6 characters'],
  },
  resetPasswordExpiry: {
    type: Date,
    default: null
  },
  refreshToken:{
    type:String,
    default:null
},
 
  fingerprint: {
    type: String,
    required: false
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


// Before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // Encrypt the password before saving
  this.password = await bcrypt.hash(this.password, 10);
  this.tokenVersion += 1;
  this.updated_at = Date.now();
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
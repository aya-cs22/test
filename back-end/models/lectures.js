const mongoose = require('mongoose');
const taskSchema = new mongoose.Schema({
  description_task: String,
  end_date: Date,

  submissions: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      submissionLink: {
        type: String,
        required: true,
        minlength: [30, 'Google Drive link must be at least 30 characters long'], 
        maxlength: [150, 'Google Drive link cannot be longer than 150 characters'],
      },
      submittedAt: {
        type: Date,
        default: Date.now
      },
      score: {
        type: Number,
        default: null
      },
      feedback: {
        type: String,
      }
    }
  ]
});
// creat schema for groups
const lecturesSchema = new mongoose.Schema({
  group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Groups',
    required: true
  },
  tasks: [taskSchema],
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
  },
  article: {
    type: String
  },
  resources: {
    type: [String],
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    minlength: [6, 'Code cannot be smaller than 6 characters'],
    maxlength: [6, 'Code cannot be longer than 6 characters'],
  },

  attendees: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      attendedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  attendanceCount: {
    type: Number,
    default: 0
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
lecturesSchema.pre('save', async function (next) {
  this.updated_at = Date.now();
  next()
});
const Lectures = mongoose.model('Lectures', lecturesSchema);
module.exports = Lectures;
const mongoose = require('mongoose');
//creat schema for groups
const groupsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type_course: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: function () {
      return this.type_course === 'offline'; // Required only if offline
    },
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },

  members: [{
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  allowedEmails: {
    type: [String],
    default: [],
    validate: {
      validator: function (emails) {
        return emails.every(email =>
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
        );
      },
      message: 'Invalid email format in allowedEmails'
    }
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  price: {
    type: Number,
    min: 0 
  },

  course_details: {
    type: [{
        title: String,
        short_description: String, 
        description: String,
        image: String 
    }],
    default: []
},

about_course: {
  type: [String],
  default: []
},

instructorName:{
  type:String,
  // required:[true , 'instructor Name is required']
},
imageCourse:{
  type:String,
  // required:[true, 'image courrse is required']
},
imageInstructor:{
  type:String,
}
});

groupsSchema.pre('save', async function (next) {
  this.updated_at = Date.now();
  next();
});
const Groups = mongoose.model('Groups', groupsSchema);
module.exports = Groups;
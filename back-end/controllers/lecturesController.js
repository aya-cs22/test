const validator = require('validator');
const xss = require('xss');
const Lectures = require('../models/lectures');
const Groups = require('../models/groups');

const User = require('../models/users');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const transporter = require('../config/mailConfig');
const mongoose = require('mongoose');

// Create Lecture
exports.createLectures = async (req, res) => {
  try {
    const { group_id, description, title, article, resources } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const generateUniqueCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = generateUniqueCode();

    const lecture = new Lectures({ group_id, title, article, description, resources, code });
    await lecture.save();

    const group = await Groups.findById(group_id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const users = await User.find({ 'groups.groupId': group_id });
    const approvedUsers = users.filter(user => 
      user.groups.some(group => group.groupId.toString() === group_id && group.status === 'approved')
    );

    for (let user of approvedUsers) {
      const group = user.groups.find(group => group.groupId.toString() === group_id);
      if (!group.attendance) group.attendance = [];

      // Add lecture to the user's attendance if not already added
      const alreadyAttended = group.attendance.some(att => att.lectureId.toString() === lecture._id.toString());
      if (!alreadyAttended) {
        group.attendance.push({
          lectureId: lecture._id,
          attendanceStatus: 'absent', 
          attendedAt: null,
        });
        group.totalAbsence = (group.totalAbsence || 0) + 1; 
      }

      // Calculate attendance percentage after adding the lecture
      const totalLectures = group.totalAttendance + group.totalAbsence;
      if (totalLectures > 0) {
        group.attendancePercentage = (group.totalAttendance / totalLectures) * 100;
      } else {
        group.attendancePercentage = 0;
      }

      await user.save();
    }

    res.status(201).json({ message: 'Lecture created successfully', lecture });
  } catch (error) {
    console.error('Error creating lecture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




exports.attendLecture = async (req, res) => {
  try {
    console.log("start attend")
    const { lectureId, code } = req.body;
    const userId = req.user.id;

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found'});
    }

    if (lecture.code !== code) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const user = await User.findById(userId);
    const groupUser = user.groups.find(group => group.groupId.toString() === lecture.group_id.toString());

    if (!groupUser) {
      return res.status(403).json({ message: 'The user does not exist in this group'});
    }

    if (groupUser.status === 'approved') {
    } else if (groupUser.status === 'special') {
      if (!groupUser.lecturesSpecial.some(specialLecture => specialLecture.toString() === lectureId)) {
        return res.status(403).json({ message: 'The lecture is not one of your lectures.' });
      }
    } else {
      return res.status(403).json({ message: 'The user is not approved or special in this group' });
    }

    const attendanceIndex = groupUser.attendance.findIndex(att => att.lectureId.toString() === lectureId);
    if (attendanceIndex !== -1) {
      const attendance = groupUser.attendance[attendanceIndex];
      if (attendance.attendanceStatus === 'present') {
        return res.status(400).json({ message: 'The user has already attended this lecture' });
      }

      attendance.attendanceStatus = 'present';
      attendance.attendedAt = Date.now();
    } else {
      groupUser.attendance.push({
        lectureId,
        attendanceStatus: 'present',
        attendedAt: Date.now(),
      });
    }

    groupUser.totalAttendance = (groupUser.totalAttendance || 0) + 1;
    groupUser.totalAbsence = Math.max((groupUser.totalAbsence || 0) - 1, 0);

    const totalLectures = groupUser.totalAttendance + groupUser.totalAbsence;
    if (totalLectures > 0) {
      groupUser.attendancePercentage = ((groupUser.totalAttendance / totalLectures) * 100).toFixed(2);
    } else {
      groupUser.attendancePercentage = 0;
    }

    lecture.attendees.push({ userId });
    lecture.attendanceCount = (lecture.attendanceCount || 0) + 1;

    await lecture.save();
    await user.save();

    res.status(200).json({
      message: 'Attendees have been registered successfully',
      attendancePercentage: groupUser.attendancePercentage.toFixed(2),
    });
  } catch (error) {
    console.error('An error occurred while registering attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};





exports.updateLecturesById = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { title, description, article, resources } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied, admin only' });
    }

    const lectureIdObj = new mongoose.Types.ObjectId(lectureId);

    const lecture = await Lectures.findById(lectureIdObj);
    
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    lecture.title = title || lecture.title;
    lecture.description = description || lecture.description;
    lecture.article = article || lecture.article;
    lecture.resources = resources || lecture.resources;

    await lecture.save();

    return res.status(200).json({ message: 'Lecture updated successfully', lecture });
  } catch (error) {
    console.error('Error updating lecture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




exports.getLectureById = async (req, res) => {
  try {
    const { lectureId } = req.params;
    let lecture = await Lectures.findById(lectureId)
      .populate('group_id', 'title')
      .select('group_id title description article resources code tasks attendees attendanceCount');

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (req.user.role === 'admin') {
      return res.status(200).json({ lecture });
    }

    const user = req.user;
    const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id._id.toString());

    if (!userGroup) {
      return res.status(403).json({ message: 'Access denied, user not in this group' });
    }

    if (userGroup.status === 'special') {
      if (!userGroup.lecturesSpecial.includes(lectureId)) {
        return res.status(403).json({ message: 'Access denied, this lecture is not part of your special lectures' });
      }
    }

    lecture = lecture.toObject();

    if (lecture.tasks) {
      lecture.tasks = lecture.tasks.map(task => {
        delete task.submissions;
        return task;
      });
    }

    delete lecture.attendees;
    delete lecture.attendanceCount;

    return res.status(200).json({ lecture });

  } catch (error) {
    console.error('Error getting lecture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};








exports.getLecturesByGroupId = async (req, res) => {
  try {
    const { groupId } = req.params;
    let lectures;

    const user = req.user;
    console.log("User role:", req.user.role); 

    if (req.user.role === 'admin') {
      lectures = await Lectures.find({ group_id: groupId })
        .populate('group_id', 'title')
        .select('group_id title description article resources code tasks attendees attendanceCount'); 
    } else {
      const approvedGroup = user.groups.find(group => group.groupId.toString() === groupId && (group.status === 'approved' || group.status === 'special'));

      if (!approvedGroup) {
        return res.status(403).json({ message: 'Access denied, user not approved in this group' });
      }

      lectures = await Lectures.find({ group_id: groupId })
        .populate('group_id', 'title')
        .select('group_id title description article resources code tasks'); 

      if (lectures && lectures.length > 0) {
        lectures = lectures.map(lecture => {
          const lectureObject = lecture.toObject();

          if (lectureObject.tasks) {
            lectureObject.tasks = lectureObject.tasks.map(task => {
              delete task.submissions;
              return task;
            });
          }
          delete lectureObject.attendees;
          delete lectureObject.attendanceCount;

          return lectureObject;
        });
      }

      if (approvedGroup.status === 'special') { 
        lectures = lectures.filter(lecture =>
          user.groups.find(group => group.lecturesSpecial.includes(lecture._id.toString()))
        );
      }
    }

    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    return res.status(200).json({ lectures });

  } catch (error) {
    console.error('Error getting lectures by group:', error);
    res.status(500).json({ message: 'Server error' });
  }
};







// Get all users' attendance for a specific lecture (Admin only)
exports.getAttendanceByLecture = async (req, res) => {
  try {
    const { lectureId } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied, admin only' });
    }

    const lecture = await Lectures.findById(lectureId).populate('attendees.userId', 'name email');
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const attendance = lecture.attendees.map(attendee => ({
      userId: attendee.userId,
      attendanceStatus: attendee.attendanceStatus,
      attendedAt: attendee.attendedAt
    }));

    if (attendance.length === 0) {
      return res.status(404).json({ message: 'No attendees found for this lecture' });
    }

    return res.status(200).json({ lectureTitle: lecture.title, attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};





// Get all users who did NOT attend a specific lecture (Admin only)
exports.getUsersNotAttendedLecture = async (req, res) => {
  try {
    const { lectureId } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied, admin only' });
    }

    const lecture = await Lectures.findById(lectureId).populate('attendees.userId', 'name email');

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const group = await Groups.findById(lecture.group_id).populate('members.user_id', 'name email');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!Array.isArray(group.members)) {
      return res.status(500).json({ message: 'Group members are not defined properly' });
    }

    const attendeesIds = lecture.attendees.map((attendee) => attendee.userId._id.toString());

    const usersNotAttended = group.members.filter(
      (member) => !attendeesIds.includes(member.user_id._id.toString())
    );

    if (usersNotAttended.length === 0) {
      return res.status(404).json({ message: 'All users attended the lecture' });
    }

    return res.status(200).json({ lectureTitle: lecture.title, usersNotAttended });
  } catch (error) {
    console.error('Error fetching non-attendees:', error);
    res.status(500).json({ message: 'Server error' });
  }
};







exports.getUserAttendanceStatusInGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const userGroup = await User.findOne(
      { _id: userId, 'groups.groupId': groupId },
      { 'groups.$': 1 }
    );

    if (!userGroup || !(userGroup.groups[0].status === 'approved' || userGroup.groups[0].status === 'special')) {
      return res.status(403).json({ message: 'User not approved or not in special status in this group' });
    }

    let lectures;

    if (userGroup.groups[0].status === 'special') {
      lectures = await Lectures.find({ 
        group_id: groupId,
        _id: { $in: userGroup.groups[0].lecturesSpecial } 
      })
      .populate('attendees.userId', 'name email')
      .select('title attendees');
    } else {
      lectures = await Lectures.find({ group_id: groupId })
      .populate('attendees.userId', 'name email')
      .select('title attendees');
    }

    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    let attendedLecturesCount = 0;
    let notAttendedLecturesCount = 0;

    const response = lectures.map((lecture) => {
      const attendee = lecture.attendees.find(
        (attendee) => attendee.userId && attendee.userId._id.equals(userId)
      );

      const isAttended = attendee ? true : false;

      if (isAttended) {
        attendedLecturesCount++;
      } else {
        notAttendedLecturesCount++;
      }

      return {
        lectureId: lecture._id, 
        title: lecture.title,
        attendedAt: isAttended ? attendee.attendedAt : 'N/A',
        status: isAttended ? 'present' : 'absent',
        scheduledAt: lecture.created_at,
      };
    });

    const totalLectures = attendedLecturesCount + notAttendedLecturesCount;
    const attendancePercentage = totalLectures > 0
      ? ((attendedLecturesCount / totalLectures) * 100).toFixed(2)
      : '0.00';

    res.status(200).json({
      groupId,
      attendedLecturesCount,
      notAttendedLecturesCount,
      attendancePercentage,
      lectures: response,
    });

  } catch (error) {
    console.error('Error fetching attendance status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserAttendanceStatusByGroupId = async (req, res) => {
  try {
    const { userId, groupId } = req.params;
    const adminId = req.user.id;
    const adminUser = await User.findById(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can access this information' });
    }

    const user = await User.findById(userId).select('groups');
    if (!user || !user.groups || user.groups.length === 0) {
      return res.status(404).json({ message: 'No groups found for this user' });
    }

    const userGroup = user.groups.find(group => group.groupId.toString() === groupId);
    if (!userGroup) {
      return res.status(404).json({ message: 'User is not in this group' });
    }

    const isSpecial = userGroup.status === 'special';
    const isApproved = userGroup.status === 'approved';
    
    if (!isSpecial && !isApproved) {
      return res.status(403).json({ message: 'User is not approved or special in this group' });
    }

    const group = await Groups.findById(groupId).select('title');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    let lectures;
    if (isSpecial) {
      lectures = await Lectures.find({ _id: { $in: userGroup.lecturesSpecial } })
        .populate('attendees.userId', 'title email')
        .select('title attendees group_id created_at');
    } else {
      lectures = await Lectures.find({ group_id: groupId })
        .populate('attendees.userId', 'title email')
        .select('title attendees group_id created_at');
    }

    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    const groupedLectures = {
      groupId,
      groupName: group.title,
      groupLectures: [],
      attendedLecturesCount: 0,
      notAttendedLecturesCount: 0,
    };

    lectures.forEach(lecture => {
      const attendee = lecture.attendees.find(
        attendee => attendee.userId && attendee.userId._id.equals(userId)
      );

      const isAttended = !!attendee;

      if (isAttended) {
        groupedLectures.attendedLecturesCount++;
      } else {
        groupedLectures.notAttendedLecturesCount++;
      }

      groupedLectures.groupLectures.push({
        title: lecture.title,
        attendedAt: isAttended ? attendee.attendedAt : 'N/A',
        status: isAttended ? 'present' : 'absent',
        scheduledAt: lecture.created_at,
      });
    });

    const totalLectures = groupedLectures.attendedLecturesCount + groupedLectures.notAttendedLecturesCount;
    groupedLectures.attendancePercentage = totalLectures > 0
      ? ((groupedLectures.attendedLecturesCount / totalLectures) * 100).toFixed(2)
      : '0.00';

    res.status(200).json(groupedLectures);

  } catch (error) {
    console.error('Error fetching attendance status by group ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




exports.getLectureAttendanceDetails = async (req, res) => {
  try {
    const { lectureId } = req.params; 
    const adminId = req.user.id; 
    const adminUser = await User.findById(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can access this information' });
    }

    const lecture = await Lectures.findById(lectureId)
      .populate('attendees.userId', 'name email') 
      .select('title attendees group_id');

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const groupMembers = await User.find({ 'groups.groupId': lecture.group_id }).select('name email ');

    const attendedUsers = [];
    const notAttendedUsers = [];

    groupMembers.forEach((member) => {
      const isAttended = lecture.attendees.some(
        (attendee) => attendee.userId && attendee.userId._id.equals(member._id)
      );

      if (isAttended) {
        attendedUsers.push({ name: member.name, email: member.email, userId: member._id, });
      } else {
        notAttendedUsers.push({ name: member.name, email: member.email , userId: member._id, });
      }
    });

    res.status(200).json({
      lectureId,
      lectureTitle: lecture.title,
      attendedUsers,
      notAttendedUsers,
    });
  } catch (error) {
    console.error('Error fetching lecture attendance details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};







// delet lecture by id
exports.deleteLecturesById = async (req, res) => {
  try {
    const { lectureId } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const deletedLecture = await Lectures.findByIdAndDelete(lectureId);
    if (!deletedLecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const users = await User.find({ 'attendance.lectureId': lectureId });

    for (const user of users) {
      const attendanceRecord = user.attendance.find(
        (record) => record.lectureId.toString() === lectureId
      );

      if (attendanceRecord) {
        if (attendanceRecord.attendanceStatus === 'present') {
          user.totalPresent = Math.max(user.totalPresent - 1, 0);
        } else if (attendanceRecord.attendanceStatus === 'absent') {
          user.totalAbsent = Math.max(user.totalAbsent - 1, 0);
        }

        user.attendance = user.attendance.filter(
          (record) => record.lectureId.toString() !== lectureId
        );

        user.tasks = user.tasks.filter(
          (task) => task.lectureId.toString() !== lectureId
        );
        await user.save();
      }
    }

    res.status(200).json({ message: 'Lecture and related attendance data deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};







exports.createTaskInLecture = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { description_task, end_date } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const newTask = {
      description_task,
      end_date,
    };

    lecture.tasks.push(newTask);
    lecture.updated_at = Date.now();
    await lecture.save();

    const createdTask = lecture.tasks[lecture.tasks.length - 1];
    const taskId = createdTask._id;

    const group = await Groups.findById(lecture.group_id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const users = await User.find({ 'groups.groupId': lecture.group_id });
    const approvedOrSpecialUsers = users.filter(user => {
      return user.groups.some(group =>
        group.groupId.toString() === lecture.group_id.toString() &&
        (group.status === 'approved' || group.status === 'special')
      );
    });

    for (const user of approvedOrSpecialUsers) {
      const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id.toString());
      if (userGroup) {
        userGroup.tasks.push({
          taskId: taskId, 
          taskName: description_task, 
          submissionLink: null, 
          submittedOnTime: null,
          submittedAt: null, 
          score: null,
          feedback: null, 
        });
        await user.save();
      }
    }

    const emailAddresses = approvedOrSpecialUsers.map(user => user.email);

    if (emailAddresses.length === 0) {
      console.log('No approved or special users to notify');
    } else {
      emailAddresses.forEach(async (email) => {
        const mailOptions = {
          from: process.env.ADMIN_EMAIL,
          to: email,
          subject: `🚀 New Task Created: "${description_task}"`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <header style="background-color: #4CAF50; color: white; text-align: center; padding: 20px;">
                <h1 style="margin: 0;">Code Eagles 🦅</h1>
                <p style="font-size: 1.2em;">Your Learning Partner</p>
              </header>
              <main style="padding: 20px;">
                <h2 style="color: #4CAF50;">📋 New Task Created: "${description_task}"</h2>
                <p>Dear User,</p>
                <p>We're excited to inform you that a new task titled <strong>"${description_task}"</strong> has been added to your lecture! 🎉</p>
                <p><strong>Task Due Date:</strong> ${end_date}</p>
                <p>Please review the task and submit your work before the due date.</p>
              </main>
              <footer style="background-color: #f9f9f9; text-align: center; padding: 10px; font-size: 0.9em; color: #666;">
                <p>Thank you for being part of Code Eagles. 🦅</p>
                <p>If you have any questions, feel free to contact us at <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50;">codeeagles653@gmail.com</a>.</p>
              </footer>
            </div>
          `,
          text: `Dear User,\n\nA new task titled "${description_task}" has been created in your lecture. You can now access the task and submit your work before the due date: ${end_date}.\n\nBest regards,\nCode Eagles`,
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email sent to ${email}`);
        } catch (error) {
          console.error(`Failed to send email to ${email}: `, error);
        }
      });
    }

    return res.status(201).json({ message: 'Task created successfully', newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// update Task In Lecture
exports.updateTaskInLecture = async (req, res) => {
  try {
    const { lectureId, taskId } = req.params;
    const { description_task, end_date } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const task = lecture.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (description_task) task.description_task = description_task;
    if (end_date) task.end_date = end_date;

    lecture.updated_at = Date.now();
    await lecture.save();

    const group = await Groups.findById(lecture.group_id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const users = await User.find({ 'groups.groupId': lecture.group_id });
    console.log('Users in group:', users);

    const approvedUsers = users.filter(user => {
      return user.groups.some(group =>
        group.groupId.toString() === lecture.group_id.toString() && group.status === 'approved'
      );
    });

    console.log('Approved users:', approvedUsers);

  /*  const emailAddresses = approvedUsers.map(user => user.email);

    if (emailAddresses.length === 0) {
      console.log('No approved users to notify');
    } else {
      emailAddresses.forEach(async (email) => {
        const mailOptions = {
          from: process.env.ADMIN_EMAIL,
          to: email,
          subject: `🚀 Task Updated: "${description_task}" in Lecture "${lecture.title}"`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <header style="background-color: #4CAF50; color: white; text-align: center; padding: 20px;">
                <h1 style="margin: 0;">Code Eagles 🦅</h1>
                <p style="font-size: 1.2em;">Your Learning Partner</p>
              </header>
              <main style="padding: 20px;">
                <h2 style="color: #4CAF50;">🔄 Task Updated: "${description_task}"</h2>
                <p>Dear User,</p>
                <p>We're notifying you that the task titled <strong>"${description_task}"</strong> in your lecture <strong>"${lecture.title}"</strong> has been updated. 🎉</p>
                <p>Please review the changes and proceed accordingly. Stay on top of your learning and keep up the great work!</p>
              </main>
              <footer style="background-color: #f9f9f9; text-align: center; padding: 10px; font-size: 0.9em; color: #666;">
                <p>Thank you for being part of Code Eagles. 🦅</p>
                <p>If you have any questions, feel free to contact us at <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50;">codeeagles653@gmail.com</a>.</p>
              </footer>
            </div>
          `,
          text: `Dear User,\n\nThe task titled "${description_task}" in your lecture "${lecture.title}" has been updated. Please review the changes and proceed accordingly.\n\nBest regards,\nCode Eagles`,
        };


        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email sent to ${email}`);
        } catch (error) {
          console.error(`Failed to send email to ${email}: `, error);
        }
      });
    }
*/
    return res.status(200).json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};



// get Task By Id 
exports.getTaskById = async (req, res) => {
  try {
    const { lectureId, taskId } = req.params;

    if (req.user.role === 'admin') {
      const lecture = await Lectures.findById(lectureId).populate('group_id');
      if (!lecture) {
        return res.status(404).json({ message: 'Lecture not found' });
      }

      const task = lecture.tasks.id(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      return res.status(200).json({ task });
    }

    const lecture = await Lectures.findById(lectureId).populate('group_id');
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const user = req.user;
    const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id._id.toString());

    if (!userGroup || (userGroup.status !== 'approved' && userGroup.status !== 'special')) {
      return res.status(403).json({ message: 'Access denied, user not approved or special in the group' });
    }

    if (userGroup.status === 'special') {
      const specialLecture = userGroup.lecturesSpecial.find(lectureId => lectureId.toString() === lecture._id.toString());
      if (!specialLecture) {
        return res.status(403).json({ message: 'Access denied, this lecture is not part of your special lectures' });
      }
    }

    const task = lecture.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(200).json({ task });
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.getAllTasksByLectureId = async (req, res) => {
  try {
    const { lectureId } = req.params;

    if (req.user.role !== 'admin') {
      const user = req.user;
      const lecture = await Lectures.findById(lectureId).populate('group_id');

      if (!lecture) {
        return res.status(404).json({ message: 'Lecture not found' });
      }

      const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id._id.toString());

      if (!userGroup) {
        return res.status(403).json({ message: 'Access denied, user is not part of this group' });
      }

      if (userGroup.status === 'special') {
        const specialLecture = userGroup.lecturesSpecial.find(lectureId => lectureId.toString() === lecture._id.toString());
        if (!specialLecture) {
          return res.status(403).json({ message: 'Access denied, this lecture is not part of your special lectures' });
        }
      }

      if (userGroup.status !== 'approved' && userGroup.status !== 'special') {
        return res.status(403).json({ message: 'Access denied, user not approved or special in the group' });
      }
    }

    const lecture = await Lectures.findById(lectureId).populate('group_id');
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const tasks = lecture.tasks;
    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.submitTask = async (req, res) => {
  try {
    const { lectureId, taskId } = req.params;
    let { submissionLink } = req.body;
    const currentDate = Date.now();

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(403).json({ message: 'User not authenticated' });
    }

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const task = lecture.tasks.find(t => t._id.toString() === taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id.toString());
    // if (!userGroup || userGroup.status !== 'approved') {
    //   return res.status(403).json({ message: 'User is not approved in this group' });
    // }

    if (currentDate > new Date(task.end_date)) {
      return res.status(403).json({ message: 'Task submission is no longer allowed as the deadline has passed' });
    }

    if (!validator.isURL(submissionLink)) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }
    submissionLink = xss(submissionLink);

    const allowedDomains = ['drive.google.com', 'github.com'];
    const url = new URL(submissionLink);
    if (!allowedDomains.includes(url.hostname)) {
      return res.status(400).json({ message: 'Only Google Drive or GitHub links are allowed' });
    }

    if (!submissionLink.startsWith('https://')) {
      return res.status(400).json({ message: 'Only HTTPS links are allowed' });
    }

    const existingSubmission = task.submissions.find(submission => submission.userId.toString() === user.id);
    if (existingSubmission) {
      existingSubmission.submissionLink = submissionLink;
      existingSubmission.submittedAt = currentDate;
      existingSubmission.submittedOnTime = currentDate <= new Date(task.end_date);
    } else {
      task.submissions.push({
        userId: user.id,
        submissionLink: submissionLink,
        submittedAt: currentDate,
        submittedOnTime: currentDate <= new Date(task.end_date),
        score: null,
        feedback: null,
      });
    }

    const userTask = userGroup.tasks.find(t => t.taskId.toString() === taskId);
    if (userTask) {
      userTask.submissionLink = submissionLink;
      userTask.submittedAt = currentDate;
      userTask.submittedOnTime = currentDate <= new Date(task.end_date);
    } else {
      userGroup.tasks.push({
        taskId: taskId,
        submissionLink: submissionLink,
        submittedAt: currentDate,
        submittedOnTime: currentDate <= new Date(task.end_date),
        score: null,
        feedback: null,
      });
    }

    await user.save();
    lecture.updated_at = Date.now();
    await lecture.save();

    return res.status(200).json({ message: 'Task submitted successfully' });
  } catch (error) {
    console.error('Error submitting task:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




exports.getUserTasksInGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    const group = await Groups.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const currentUser = await User.findById(req.user.id);
    const isAdmin = currentUser.role === 'admin' || group.admin.toString() === req.user.id;

    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not an admin of this group' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userGroup = user.groups.find(g => g.groupId.toString() === groupId);
    if (!userGroup) {
      return res.status(404).json({ message: 'User is not a member of this group' });
    }

    const tasks = userGroup.tasks;

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};









const updateTotalScore = async (userId, groupId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userGroup = user.groups.find(group => group.groupId.toString() === groupId.toString());
    if (!userGroup) {
      throw new Error('User group not found');
    }

    const totalScore = userGroup.tasks.reduce((sum, task) => {
      return sum + (task.score || 0);
    }, 0);

    userGroup.totalScore = totalScore;
    await user.save();

    console.log(`Total score updated for user ${userId} in group ${groupId}: ${totalScore}`);
  } catch (error) {
    console.error('Error updating total score:', error);
  }
};




exports.addScoreAndFeedback = async (req, res) => {
  try {
    const { lectureId, taskId, userId } = req.params;
    const { score, feedback } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only admins can add scores and feedback.' });
    }

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const task = lecture.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const submission = task.submissions.find(sub => sub.userId.toString() === userId);
    if (!submission) {
      return res.status(404).json({ message: 'User submission not found' });
    }

    submission.score = score;
    submission.feedback = feedback;
    lecture.updated_at = Date.now();
    await lecture.save();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id.toString());
    // if (!userGroup || userGroup.status !== 'approved') {
    //   return res.status(403).json({ message: 'User is not approved in this group' });
    // }

    const userTask = userGroup.tasks.find(t => t.taskId.toString() === taskId);
    if (!userTask) {
      return res.status(404).json({ message: 'User task not found' });
    }

    userTask.score = score;
    userTask.feedback = feedback;
    await user.save();

    await updateTotalScore(userId, lecture.group_id);

    return res.status(200).json({ message: 'Score and feedback added successfully', submission });
  } catch (error) {
    console.error('Error adding score and feedback:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};





exports.getUserTasksByGroupId = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userGroup = user.groups.find(group => group.groupId.toString() === groupId);
    if (!userGroup) {
      return res.status(404).json({ message: 'User is not part of this group' });
    }

    const userLectures = userGroup.lecturesSpecial; // فقط المحاضرات التي في lecturesSpecial
    if (!userLectures || userLectures.length === 0) {
      return res.status(404).json({ message: 'No special lectures found for this group' });
    }

    const lectures = await Lectures.find({ _id: { $in: userLectures } });
    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this user in special lectures' });
    }

    const userTasks = [];

    lectures.forEach(lecture => {
      lecture.tasks.forEach(task => {
        if (!task || !task._id) {
          console.error('Task or task._id is undefined:', task);
          return; 
        }

        const userSubmissionInLecture = task.submissions.find(sub => sub.userId.toString() === userId);

        const userTaskInUserSchema = userGroup.tasks.find(t => {
          if (!t || !t.taskId) {
            console.error('Task or taskId is undefined:', t);
            return false; 
          }
          return t.taskId.toString() === task._id.toString();
        });
        const submission = userSubmissionInLecture || userTaskInUserSchema;

        userTasks.push({
          lectureId: lecture._id,
          lectureTitle: lecture.title,
          taskId: task._id,
          taskDescription: task.description_task,
          endDate: task.end_date,
          submission: submission
            ? {
                submissionLink: submission.submissionLink,
                submittedAt: submission.submittedAt,
                submittedOnTime: submission.submittedOnTime,
                score: submission.score,
                feedback: submission.feedback,
              }
            : null,
          score: submission ? submission.score : null, 
          feedback: submission ? submission.feedback : null,
        });
      });
    });

    return res.status(200).json({ tasks: userTasks });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};











exports.getTaskSubmissions = async (req, res) => {
  try {
    const { lectureId, taskId } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Only admins can access this endpoint.' });
    }

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const task = lecture.tasks.find(t => t._id.toString() === taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const group = await Groups.findById(lecture.group_id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const users = await User.find({ 'groups.groupId': lecture.group_id });

    const submittedUsers = [];
    const notSubmittedUsers = [];

    users.forEach(user => {
      const submission = task.submissions.find(sub => sub.userId.toString() === user._id.toString());

      if (submission) {
        submittedUsers.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          submission: {
            submissionLink: submission.submissionLink,
            submittedAt: submission.submittedAt,
            submittedOnTime: submission.submittedOnTime,
            score: submission.score,
            feedback: submission.feedback,
          },
        });
      } else {
        notSubmittedUsers.push({
          userId: user._id,
          name: user.name,
          email: user.email,
        });
      }
    });

    return res.status(200).json({
      submittedUsers,
      notSubmittedUsers,
    });
  } catch (error) {
    console.error('Error fetching task submissions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




exports.deleteTask = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { lectureId, taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lectureId) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: 'Invalid lectureId or taskId' });
    }

    session.startTransaction();

    const lecture = await Lectures.findById(lectureId).session(session);
    if (!lecture) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const taskIndex = lecture.tasks.findIndex(task => task._id.toString() === taskId);
    if (taskIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Task not found in this lecture' });
    }

    const task = lecture.tasks[taskIndex];
    const submissionUserIds = task.submissions.map(submission => submission.userId);

    lecture.tasks.splice(taskIndex, 1);
    await lecture.save({ session });

    const groupId = lecture.group_id;

    await User.updateMany(
      { 'groups.groupId': groupId }, 
      { $pull: { 'groups.$[group].tasks': { taskId: new mongoose.Types.ObjectId(taskId) } } },
      {
        session,
        arrayFilters: [{ 'group.groupId': groupId }],
      }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Task and related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);

    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: 'Server error' });
  }
};






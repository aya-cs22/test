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
    const { lectureId, code } = req.body;
    const userId = req.user.id;

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.code !== code) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const user = await User.findById(userId);
    const groupUser = user.groups.find(group => group.groupId.toString() === lecture.group_id.toString());
    if (!groupUser || groupUser.status !== 'approved') {
      return res.status(403).json({ message: 'User not approved in this group' });
    }

    const attendanceIndex = groupUser.attendance.findIndex(att => att.lectureId.toString() === lectureId);
    if (attendanceIndex !== -1) {
      const attendance = groupUser.attendance[attendanceIndex];
      if (attendance.attendanceStatus === 'present') {
        return res.status(400).json({ message: 'User already attended this lecture' });
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
      message: 'Attendance recorded successfully',
      attendancePercentage: groupUser.attendancePercentage.toFixed(2), 
    });
  } catch (error) {
    console.error('Error attending lecture:', error);
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

    if (!userGroup || userGroup.groups[0].status !== 'approved') {
      return res.status(403).json({ message: 'User not approved in this group' });
    }

    const lectures = await Lectures.find({ group_id: groupId });

    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    let attendedLecturesCount = 0;
    let notAttendedLecturesCount = 0;

    const response = lectures.map((lecture) => {
      const attendee = lecture.attendees.find(att => att.userId.toString() === userId);
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
      };
    });

    const attendancePercentage = ((attendedLecturesCount / lectures.length) * 100).toFixed(2);

    res.status(200).json({
      groupId,
      attendedLecturesCount,
      notAttendedLecturesCount,
      attendancePercentage,
      lectures: response,
    });
  } catch (error) {
    console.error('Error fetching user attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Lecture
exports.updateLecturesById = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { title, description, article, resources } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied, admin only' });
    }

    const lecture = await Lectures.findById(lectureId);
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




// Get Lecture by ID
exports.getLectureById = async (req, res) => {
  try {
    const { lectureId } = req.params;

    if (req.user.role === 'admin') {
      const lecture = await Lectures.findById(lectureId).populate('group_id');
      if (!lecture) {
        return res.status(404).json({ message: 'Lecture not found' });
      }
      return res.status(200).json({ lecture });
    }

    const lecture = await Lectures.findById(lectureId).populate('group_id');
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const user = req.user;
    const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id._id.toString());

    if (!userGroup || userGroup.status !== 'approved') {
      return res.status(403).json({ message: 'Access denied, user not approved in the group' });
    }

    return res.status(200).json({ lecture });
  } catch (error) {
    console.error('Error getting lecture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// Get Lectures by group_id

exports.getLecturesByGroupId = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (req.user.role === 'admin') {
      const lectures = await Lectures.find({ group_id: groupId }).populate('group_id');
      if (!lectures || lectures.length === 0) {
        return res.status(404).json({ message: 'No lectures found for this group' });
      }
      return res.status(200).json({ lectures });
    }

    const user = req.user;
    const approvedGroup = user.groups.find(group => group.groupId.toString() === groupId && group.status === 'approved');

    if (!approvedGroup) {
      return res.status(403).json({ message: 'Access denied, user not approved in this group' });
    }

    const lectures = await Lectures.find({ group_id: groupId }).populate('group_id');
    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    return res.status(200).json({ lectures });
  } catch (error) {
    console.error('Error getting lectures by group:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// attend user
exports.attendLecture = async (req, res) => {
  try {
    const { lectureId, code } = req.body;
    const userId = req.user.id;

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.code !== code) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const user = await User.findById(userId);
    const groupUser = user.groups.find(group => group.groupId.toString() === lecture.group_id.toString());
    if (!groupUser || groupUser.status !== 'approved') {
      return res.status(403).json({ message: 'User not approved in this group' });
    }

    const attendanceIndex = groupUser.attendance.findIndex(att => att.lectureId.toString() === lectureId);
    if (attendanceIndex !== -1) {
      const attendance = groupUser.attendance[attendanceIndex];
      if (attendance.attendanceStatus === 'present') {
        return res.status(400).json({ message: 'User already attended this lecture' });
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

    // Update total attendance and absence
    groupUser.totalAttendance = (groupUser.totalAttendance || 0) + 1;
    groupUser.totalAbsence = Math.max((groupUser.totalAbsence || 0) - 1, 0);

    // Calculate the correct attendance percentage based on the updated values
    const totalLectures = groupUser.totalAttendance + groupUser.totalAbsence;
    if (totalLectures > 0) {
      groupUser.attendancePercentage = (groupUser.totalAttendance / totalLectures) * 100;
    } else {
      groupUser.attendancePercentage = 0;
    }

    // Update lecture attendance count
    lecture.attendees.push({ userId });
    lecture.attendanceCount = (lecture.attendanceCount || 0) + 1;

    await lecture.save();
    await user.save();

    res.status(200).json({
      message: 'Attendance recorded successfully',
      attendancePercentage: groupUser.attendancePercentage.toFixed(2), // Show percentage with two decimal places
    });
  } catch (error) {
    console.error('Error attending lecture:', error);
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





// exports.getUserAttendedLecturesInGroup = async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const userId = req.user.id;

//     const lectures = await Lectures.find({ group_id: groupId })
//       .populate('attendees.userId', 'name email')
//       .select('title attendees');

//     if (!lectures || lectures.length === 0) {
//       return res.status(404).json({ message: 'No lectures found for this group' });
//     }

//     // التحقق من الحضور داخل الـ `groups.attendance`
//     const attendedLectures = lectures.filter((lecture) => {
//       return lecture.attendees.some((attendee) => 
//         attendee.userId._id.toString() === userId &&
//         attendee.attendanceStatus === 'present'
//       );
//     });

//     if (attendedLectures.length === 0) {
//       return res.status(404).json({ message: 'User has not attended any lectures in this group' });
//     }

//     const response = attendedLectures.map((lecture) => ({
//       title: lecture.title,
//       attendedAt: lecture.attendees.find(
//         (attendee) => attendee.userId._id.toString() === userId
//       )?.attendedAt || 'N/A',
//     }));

//     res.status(200).json({ attendedLectures: response });
//   } catch (error) {
//     console.error('Error fetching attended lectures:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };


// exports.getUserNotAttendedLecturesInGroup = async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const userId = req.user.id;

//     const lectures = await Lectures.find({ group_id: groupId })
//       .populate('attendees.userId', 'name email')
//       .select('title attendees');

//     if (!lectures || lectures.length === 0) {
//       return res.status(404).json({ message: 'No lectures found for this group' });
//     }

//     const notAttendedLectures = lectures.filter((lecture) => {
//       return !lecture.attendees.some((attendee) => 
//         attendee.userId._id.toString() === userId &&
//         attendee.attendanceStatus === 'present'
//       );
//     });

//     if (notAttendedLectures.length === 0) {
//       return res.status(404).json({ message: 'User has attended all lectures in this group' });
//     }

//     const response = notAttendedLectures.map((lecture) => ({
//       title: lecture.title,
//       scheduledAt: lecture.created_at,
//     }));

//     res.status(200).json({ notAttendedLectures: response });
//   } catch (error) {
//     console.error('Error fetching non-attended lectures:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };




// للحصول على تفاصيل الحضور الخاصة بالمستخدم في الجروب



exports.getUserAttendanceStatusInGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const userGroup = await User.findOne(
      { _id: userId, 'groups.groupId': groupId },
      { 'groups.$': 1 }
    );

    if (!userGroup || userGroup.groups[0].status !== 'approved') {
      return res.status(403).json({ message: 'User not approved in this group' });
    }

    const lectures = await Lectures.find({ group_id: groupId })
      .populate('attendees.userId', 'name email')
      .select('title attendees');

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

    const isApprovedGroup = user.groups.some(
      group => group.groupId.toString() === groupId && group.status === 'approved'
    );

    if (!isApprovedGroup) {
      return res.status(404).json({ message: 'User is not approved in this group' });
    }

    const group = await Groups.findById(groupId).select('title');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const lectures = await Lectures.find({ group_id: groupId })
      .populate('attendees.userId', 'title email')
      .select('title attendees group_id created_at');

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




// create task by admin
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
    // const updatedLecture = await Lectures.findById(lectureId).populate('tasks');

    lecture.tasks.push(newTask);
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

    const emailAddresses = approvedUsers.map(user => user.email);

    if (emailAddresses.length === 0) {
      console.log('No approved users to notify');
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
                <p>If you have any questions, feel free to contact us at <a href="mailto:codeeagles653@gmail.com
" style="color: #4CAF50;">codeeagles653@gmail.com</a>.</p>
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

    const emailAddresses = approvedUsers.map(user => user.email);

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

    if (!userGroup || userGroup.status !== 'approved') {
      return res.status(403).json({ message: 'Access denied, user not approved in the group' });
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
      const lecture = await Lectures.findById(lectureId);

      if (!lecture) {
        return res.status(404).json({ message: 'Lecture not found' });
      }

      const userGroup = user.groups.find(group => group.groupId.toString() === lecture.group_id._id.toString());
      if (!userGroup || userGroup.status !== 'approved') {
        return res.status(403).json({ message: 'Access denied, user not approved in the group' });
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

    if (currentDate > new Date(task.end_date)) {
      return res.status(403).json({ message: 'Task submission is no longer allowed as the deadline has passed' });
    }

    if (!validator.isURL(submissionLink)) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }
    submissionLink = xss(submissionLink);
    const allowedDomain = 'drive.google.com';
    const url = new URL(submissionLink);

    if (url.hostname !== allowedDomain) {
      return res.status(400).json({ message: 'Only Google Drive links are allowed' });
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

    // Update or add task in user's record
    const userTask = user.tasks.find(t => t.lectureId.toString() === lectureId && t.taskId.toString() === taskId);
    if (userTask) {
      userTask.submissionLink = submissionLink;
      userTask.submittedAt = currentDate;
      userTask.submittedOnTime = currentDate <= new Date(task.end_date);
    } else {
      user.tasks.push({
        lectureId: lectureId,
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





exports.evaluateTask = async (req, res) => {
  try {
    const { lectureId, taskId, submissionId } = req.params;
    const { score, feedback } = req.body;
    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }
    const task = lecture.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const submission = task.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.score = score;
    submission.feedback = feedback;

    await lecture.save();

    const user = await User.findById(submission.userId);
    if (user) {
      const userTask = user.tasks.find(t => t.lectureId.toString() === lectureId && t.taskId.toString() === taskId);
      if (userTask) {
        userTask.score = score;
        userTask.feedback = feedback;
        await user.save();
      }

      const mailOptions = {
        from: process.env.ADMIN_EMAIL,
        to: user.email,
        subject: '📊 Task Evaluation Results',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <header style="background-color: #4CAF50; color: white; text-align: center; padding: 20px;">
              <h1 style="margin: 0;">Code Eagles 🦅</h1>
              <p style="font-size: 1.2em;">Your Task Evaluation Results</p>
            </header>
            <main style="padding: 20px;">
              <h2 style="color: #4CAF50;">📊 Task Evaluation Completed!</h2>
              <p>Dear ${user.name},</p>
              <p>We have evaluated your task, and here are your results:</p>
              <p><strong>Score:</strong> ${score}</p>
              <p><strong>Feedback:</strong></p>
              <p style="font-style: italic; color: #555;">"${feedback}"</p>
              <p>Keep up the great work and continue improving! 💪</p>
            </main>
            <footer style="background-color: #f9f9f9; text-align: center; padding: 10px; font-size: 0.9em; color: #666;">
              <p>Thank you for being part of Code Eagles! 🦅</p>
              <p>If you have any questions or need further assistance, feel free to contact us at <a href="mailto:codeeagles653@gmail.com" style="color: #4CAF50;">codeeagles653@gmail.com</a>.</p>
            </footer>
          </div>
        `,
        text: `Dear ${user.name},\n\nYour task has been evaluated.\nScore: ${score}\nFeedback: ${feedback}\n\nBest regards,\nCode Eagles`,
      };


      await transporter.sendMail(mailOptions);
    }

    return res.status(200).json({ message: 'Task evaluated and email sent successfully', score, feedback });
  } catch (error) {
    console.error('Error evaluating task:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};





exports.getAllUserSubmissionsForTask = async (req, res) => {
  try {
    const { lectureId, taskId } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const lecture = await Lectures.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const task = lecture.tasks.find(task => task._id.toString() === taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const taskSubmissions = await Promise.all(
      task.submissions.map(async (submission) => {
        const user = await User.findById(submission.userId);
        return {
          submissionId: submission._id,
          userId: submission.userId,
          email: user.email,
          userName: user.name,
          submissionLink: submission.submissionLink,
          submittedAt: submission.submittedAt,
          submittedOnTime: submission.submittedOnTime,
          score: submission.score,
          feedback: submission.feedback,
        };
      })
    );
    return res.status(200).json({
      taskId: task._id,
      taskTitle: task.description_task,
      submissions: taskSubmissions,
    });
  } catch (error) {
    console.error('Error fetching submissions for task:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




exports.getUsersNotSubmittedTask = async (req, res) => {
  try {
    const { lectureId, taskId } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const lecture = await Lectures.findById(lectureId).populate('group_id');
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const group = lecture.group_id;
    if (!group || !group.members || group.members.length === 0) {
      return res.status(404).json({ message: 'No members found in this group' });
    }

    const task = lecture.tasks.find(t => t._id.toString() === taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const users = await User.find({
      '_id': { $in: group.members.map(member => member.user_id) }
    });

    const usersNotSubmitted = [];

    for (let user of users) {
      const taskSubmission = task.submissions.find(submission => submission.userId.toString() === user._id.toString());

      if (!taskSubmission) {
        usersNotSubmitted.push(user);
      }
    }

    return res.status(200).json(usersNotSubmitted);
  } catch (error) {
    console.error('Error fetching users who did not submit task:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




exports.getUserSubmissionsForGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    const lectures = await Lectures.find({ group_id: groupObjectId });
    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    const userTasks = lectures.flatMap(lecture => {
      const tasksWithSubmissions = lecture.tasks.filter(task =>
        task.submissions.some(submission => submission.userId.toString() === userId)
      );

      if (tasksWithSubmissions.length > 0) {
        return tasksWithSubmissions.map(task => ({
          lectureTitle: lecture.title,
          taskDescription: task.description_task,
          endDate: task.end_date,
          submission: task.submissions.find(submission => submission.userId.toString() === userId)
        }));
      }

      return [];
    });

    if (userTasks.length === 0) {
      return res.status(404).json({ message: 'No submissions found for this user in this group' });
    }

    return res.status(200).json({ tasks: userTasks });
  } catch (error) {
    console.error('Error fetching user submissions for group:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




exports.getUserUnsubmittedTasksForGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    const lectures = await Lectures.find({ group_id: groupObjectId });
    if (!lectures || lectures.length === 0) {
      return res.status(404).json({ message: 'No lectures found for this group' });
    }

    const unsubmittedTasks = lectures.flatMap(lecture => {
      const tasksWithoutSubmissions = lecture.tasks.filter(task =>
        !task.submissions.some(submission => submission.userId.toString() === userId)
      );

      if (tasksWithoutSubmissions.length > 0) {
        return tasksWithoutSubmissions.map(task => ({
          lectureTitle: lecture.title,
          taskDescription: task.description_task,
          endDate: task.end_date,
        }));
      }

      return [];
    });

    if (unsubmittedTasks.length === 0) {
      return res.status(404).json({ message: 'All tasks have been submitted by this user for this group' });
    }

    return res.status(200).json({ tasks: unsubmittedTasks });
  } catch (error) {
    console.error('Error fetching user unsubmitted tasks for group:', error);
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
      return res.status(404).json({ message: 'Lecture not found' });
    }

    const taskIndex = lecture.tasks.findIndex(task => task._id.toString() === taskId);
    if (taskIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Task not found in this lecture' });
    }

    const task = lecture.tasks[taskIndex];
    const submissionUserIds = task.submissions.map(submission => submission.userId);

    lecture.tasks.splice(taskIndex, 1);
    await lecture.save({ session });

    await User.updateMany(
      { _id: { $in: submissionUserIds } },
      { $pull: { tasks: { taskId: taskId } } },
      { session }
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
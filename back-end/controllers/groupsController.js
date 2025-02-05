const Groups = require('../models/groups');
const moment = require('moment');
const { use } = require('../config/mailConfig');
const mongoose = require('mongoose');
const User = require('../models/users');
const Lectures = require('../models/lectures');

const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.ADMIN_EMAIL,
//         pass: process.env.ADMIN_EMAIL_PASSWORD,
//     },
// });

// creat group by admin
exports.creatGroups = async (req, res) => {
    try {
        const { title, type_course, location, start_date, end_date , price, course_details, about_course, instructorName,imageCourse , imageInstructor} = req.body;
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Acess denied' });
        }

        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ message: 'Invalid price value' });
        }
        const groups = new Groups({

            title,
            type_course, location,
            location,
            start_date,
            end_date,
            price ,
            course_details: course_details || [],
            about_course: about_course || [],
            instructorName,
            imageCourse,
            imageInstructor
        });
        await groups.save();
        res.status(201).json(groups);
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'server error' });
    }
};

// get all groups
exports.getAllGroups = async (req, res) => {
    try {
        const isAdmin = req.user && req.user.role === 'admin'; 
        console.log(req.user)
        const groups = await Groups.find().select(isAdmin ? {} : 'title type_course location start_date end_date course_details about_course  instructorName imageCourse');

        res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ message: 'server error', error: error.message });
    }
};


// get all groups
exports.getAllGroupsByAdmin = async (req, res) => {
    try {
        const isAdmin = req.user && req.user.role === 'admin'; 
        console.log(req.user)
        const groups = await Groups.find().select(isAdmin ? {} : 'title type_course location start_date end_date');

        res.status(200).json(groups);
    } catch (error) {
        res.status(500).json({ message: 'server error', error: error.message });
    }
};




exports.getGroupsById = async (req, res) => {
    try {
        const group = await Groups.findById(req.params.groupId).select(
            'title type_course location start_date end_date course_details about_course instructorName imageCourse'
        );

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        return res.status(200).json(group);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getGroupByIdAdmin = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const group = await Groups.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        return res.status(200).json(group);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ message: 'Server error' });
    }
};












// update group by id
exports.updateGroupsById = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { title, type_course, location, start_date, end_date, price, course_details, about_course ,  instructorName,imageCourse } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const updateGroupsData = {
            title: title,
            type_course: type_course,
            location: location || "",
            start_date: start_date,
            end_date: end_date,
            price: price,
            course_details: course_details,
            about_course :about_course,
            instructorName: instructorName,
            imageCourse: imageCourse,
        };

        const updatedGroup = await Groups.findByIdAndUpdate(groupId, updateGroupsData, { new: true, runValidators: true });

        if (!updatedGroup) {
            return res.status(404).json({ message: 'Group not found' });
        }

        res.status(200).json(updatedGroup);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};




exports.sendGroupId = async (req, res) => {
    try {
        const { groupId } = req.body;

        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is required' });
        }

        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        res.status(200).json({ message: 'Group found', groupId: group._id });
    } catch (error) {
        console.error('Error sending group ID:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


exports.deleteGroupsById = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { groupId } = req.params;

        console.log('Received groupId:', groupId);

        // التحقق من صحة الـ groupId
        if (!mongoose.Types.ObjectId.isValid(groupId) || groupId.length !== 24) {
            return res.status(400).json({ message: 'Invalid group ID format' });
        }

        // البحث عن الجروب في قاعدة البيانات
        const group = await Groups.findById(groupId).session(session);
        if (!group) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Group not found' });
        }

        // حذف المحاضرات المرتبطة بالجروب
        const deleteLecturesResult = await Lectures.deleteMany({ group_id: groupId }).session(session);
        if (deleteLecturesResult.deletedCount === 0) {
            console.log('No lectures were found to delete for this group');
        } else {
            console.log(`${deleteLecturesResult.deletedCount} lectures deleted`);
        }

        // تحديث المستخدمين وإزالة الجروب المرتبط بهم
        await User.updateMany(
            { "groups.groupId": groupId },
            { $pull: { "groups": { groupId: groupId } } },
            { session }
        );

        // حذف الجروب من قاعدة البيانات
        await Groups.findByIdAndDelete(groupId).session(session);

        // تأكيد التغيير
        await session.commitTransaction();

        return res.status(200).json({ message: 'Group and related data successfully deleted' });

    } catch (error) {
        await session.abortTransaction();
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        session.endSession();
    }
};


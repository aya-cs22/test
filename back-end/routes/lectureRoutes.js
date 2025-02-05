const express = require('express');
const router = express.Router();
const Lectures = require('../models/lectures');
const lecturesController = require('../controllers/lecturesController.js');
const authMiddleware = require('../middleware/authenticate');
const lecturesValidator = require('../utils/validators/lecturesValidator.js');


console.log("Start");
router.post('/', authMiddleware, lecturesController.createLectures);
router.put('/:lectureId', authMiddleware, lecturesController.updateLecturesById);
router.get('/:lectureId', authMiddleware, lecturesController.getLectureById);
router.get('/group/:groupId', authMiddleware, lecturesController.getLecturesByGroupId);
router.post('/attend', authMiddleware, lecturesController.attendLecture);

router.get('/:lectureId/attendance', authMiddleware, lecturesController.getAttendanceByLecture);
router.get('/:lectureId/non-attendees', authMiddleware, lecturesController.getUsersNotAttendedLecture);
// router.get('/:groupId/attended-lectures', authMiddleware, lecturesController.getUserAttendedLecturesInGroup);
// router.get('/:groupId/non-attended-lectures', authMiddleware, lecturesController.getUserNotAttendedLecturesInGroup);
router.delete('/:lectureId', authMiddleware, lecturesController.deleteLecturesById);
router.post('/:lectureId/createtasks', authMiddleware, lecturesController.createTaskInLecture);
router.put('/:lectureId/edit-task/:taskId', authMiddleware, lecturesController.updateTaskInLecture);
router.get('/:lectureId/tasks/:taskId', authMiddleware, lecturesController.getTaskById);
router.get('/:lectureId/get-tasks', authMiddleware, lecturesController.getAllTasksByLectureId);
router.post('/:lectureId/submit-task/:taskId', authMiddleware,lecturesValidator,  lecturesController.submitTask);
router.put('/:lectureId/tasks/:taskId/submissions/:userId/evaluate', authMiddleware, lecturesController.addScoreAndFeedback);
router.get('/groups/:groupId/tasks', authMiddleware, lecturesController.getUserTasksByGroupId);
router.get('/:lectureId/tasks/:taskId/submissions', authMiddleware, lecturesController.getTaskSubmissions);

router.delete('/:lectureId/tasks/:taskId', authMiddleware, lecturesController.deleteTask);

router.get('/:groupId/get-user-attendance-status-in-group', authMiddleware, lecturesController.getUserAttendanceStatusInGroup);
router.get('/:userId/:groupId/attendance-by-admin', authMiddleware, lecturesController.getUserAttendanceStatusByGroupId);
router.get('/:lectureId/get-lecture-attendance-details', authMiddleware, lecturesController.getLectureAttendanceDetails);
router.get('/:groupId/:userId/get-user-tasks-in-group', authMiddleware, lecturesController.getUserTasksInGroup);


module.exports = router;
const express = require('express');
const router = express.Router();
// const rateLimiter = require('../middleware/rateLimiter');
const userValidator = require('../utils/validators/userValidator');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authenticate')


//authentication
router.post('/register', userValidator, userController.register);
router.post('/verify-Email', userValidator, userController.verifyEmail);
router.post('/login',userValidator, userController.login);
router.post('/forgot-password', userValidator, userController.forgotPassword);
router.post('/reset-password', userValidator, userController.resetPassword);

//feedback
router.post('/submit-feedback', authMiddleware,userController.submitFeedback);
router.get('/get-all-feedback', userController.getAllFeedback);
router.delete('/:userId/feedback', authMiddleware, userController.deleteFeedback);

router.post('/add-allowed-emails', authMiddleware, userValidator, userController.addAllowedEmails);
router.get('/get-allowed-emails', authMiddleware, userController.getAllowedEmails);
router.put('/update-allowed-emails', authMiddleware, userController.updateAllowedEmails);
router.delete('/remove-allowed-email', authMiddleware, userController.removeAllowedEmail);


router.get('/pending-users', authMiddleware, userController.getPendingUsers);
router.post('/adduser', authMiddleware, userController.addUser);
router.get('/', authMiddleware, userController.getUserByhimself);
router.get('/all-users', authMiddleware, userController.getAllUsers);
router.get('/:id', authMiddleware, userController.getUserByid);

router.put('/', authMiddleware, userController.updateUser);
router.put('/:id', authMiddleware, userController.updateUserRole);

router.delete('/:id?', authMiddleware, userController.deleteUser);


//join group
router.post('/joinGroupRequest', authMiddleware, userController.joinGroupRequest);
router.get('/pending-join-requests/:groupId', authMiddleware, userController.getPendingJoinRequestsByGroup);

router.post('/accept-join-request', authMiddleware, userController.acceptJoinRequest);
router.put('/set-role-to-pending/:userId/:groupId', authMiddleware, userController.setRoleToPending);
router.put('/set-role-to-approved/:userId/:groupId', authMiddleware, userController.setRoleToApproved);

router.post('/reject-join-request', authMiddleware, userController.rejectJoinRequest);


router.post('/leave-group', authMiddleware, userController.leaveGroup);


module.exports = router; 
const express = require('express');
const router = express.Router();
const Groups = require('../models/groups');
const groupsController = require('../controllers/groupsController.js');
const authMiddleware = require('../middleware/authenticate');

router.post('/', authMiddleware, groupsController.creatGroups);
router.post('/send-group-id', authMiddleware, groupsController.sendGroupId);

router.get('/', groupsController.getAllGroups);
router.get('/get-all-group-by-admin', authMiddleware, groupsController.getAllGroupsByAdmin);

router.get('/:groupId', groupsController.getGroupsById);
router.get('/get-groupId-by-admin/:groupId', authMiddleware, groupsController.getGroupByIdAdmin);

router.put('/:groupId', authMiddleware, groupsController.updateGroupsById);
router.delete('/:groupId', authMiddleware, groupsController.deleteGroupsById);

module.exports = router;
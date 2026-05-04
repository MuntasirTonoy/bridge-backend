const express = require('express');
const router = express.Router();
const { updateProfile, blockUser, archiveChat, changePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/block', protect, blockUser);
router.post('/archive', protect, archiveChat);

module.exports = router;

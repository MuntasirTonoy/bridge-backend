const express = require('express');
const router = express.Router();
const { registerUser, authUser, getUserProfile, getUsers, checkUsername } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup', registerUser);
router.post('/login', authUser);
router.get('/profile', protect, getUserProfile);
router.get('/users', protect, getUsers);
router.get('/check-username', checkUsername);

module.exports = router;

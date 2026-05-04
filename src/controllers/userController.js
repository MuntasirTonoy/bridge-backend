const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, username, bio, location, profilePic, gender, mobileNumber, dateOfBirth } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existing = await User.findOne({ username });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (profilePic !== undefined) user.profilePic = profilePic;
    if (gender !== undefined) user.gender = gender;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;

    await user.save();

    const updatedUser = await User.findById(req.user.id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(req.user.id);
    
    if (user.blockedUsers.includes(userId)) {
      user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userId);
      await user.save();
      return res.json({ message: 'User unblocked', blockedUsers: user.blockedUsers });
    } else {
      user.blockedUsers.push(userId);
      await user.save();
      return res.json({ message: 'User blocked', blockedUsers: user.blockedUsers });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const archiveChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(req.user.id);
    
    if (user.archivedChats.includes(userId)) {
      user.archivedChats = user.archivedChats.filter(id => id.toString() !== userId);
      await user.save();
      return res.json({ message: 'Chat unarchived', archivedChats: user.archivedChats });
    } else {
      user.archivedChats.push(userId);
      await user.save();
      return res.json({ message: 'Chat archived', archivedChats: user.archivedChats });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { updateProfile, blockUser, archiveChat, changePassword };

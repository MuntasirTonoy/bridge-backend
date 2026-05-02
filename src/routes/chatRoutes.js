const express = require('express');
const router = express.Router();
const { 
  getConversations, 
  getOrCreateConversation, 
  getMessages, 
  sendMessage, 
  deleteChat,
  editMessage,
  deleteMessage 
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

// Conversations
router.get('/conversations', protect, getConversations);
router.post('/conversations', protect, getOrCreateConversation);

// Messages
router.get('/messages/:userId', protect, getMessages);
router.post('/messages', protect, sendMessage);
router.put('/messages/:messageId', protect, editMessage);
router.delete('/messages/:messageId', protect, deleteMessage);

// Delete chat (conversation)
router.delete('/:userId', protect, deleteChat);

module.exports = router;

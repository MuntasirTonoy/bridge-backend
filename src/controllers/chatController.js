const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get all conversations for the current user (for sidebar)
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
      deletedBy: { $ne: req.user.id }
    })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ lastUpdated: -1 });

    const Message = require('../models/Message');
    const convsWithUnread = await Promise.all(conversations.map(async (c) => {
      const otherParticipant = c.participants.find(p => p._id.toString() !== req.user.id);
      let unreadCount = 0;
      if (otherParticipant) {
        unreadCount = await Message.countDocuments({
          senderId: otherParticipant._id,
          receiverId: req.user.id,
          isRead: false
        });
      }
      return {
        ...c.toObject(),
        unreadCount
      };
    }));

    res.json(convsWithUnread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get or create a conversation between two users
const getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId], $size: 2 }
    })
      .populate('participants', '-password')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, userId]
      });
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', '-password')
        .populate('lastMessage');
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get messages for a conversation (between current user and another user)
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId }
      ],
      deletedBy: { $ne: currentUserId }
    }).sort({ createdAt: 1 });

    // Mark unread messages as read
    await Message.updateMany(
      { senderId: userId, receiverId: currentUserId, isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, fileUrl, fileType, filePublicId } = req.body;
    const senderId = req.user.id;

    if (!text && !fileUrl) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    // Check for blocking
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (sender.blockedUsers.includes(receiverId)) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    if (receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({ message: 'You are blocked by this user' });
    }

    // Create message
    const message = await Message.create({
      senderId,
      receiverId,
      text,
      fileUrl,
      fileType: fileType || 'text',
      filePublicId
    });

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
        lastMessage: message._id,
        lastUpdated: new Date(),
        deletedBy: []
      });
    } else {
      conversation.lastMessage = message._id;
      conversation.lastUpdated = new Date();
      conversation.deletedBy = [];
      await conversation.save();
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete chat (soft delete for user, full delete if both delete)
const deleteChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Find the conversation
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId], $size: 2 }
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Add user to deletedBy for the conversation
    if (!conversation.deletedBy.includes(currentUserId)) {
      conversation.deletedBy.push(currentUserId);
    }

    // Add user to deletedBy for all messages between these users
    await Message.updateMany(
      {
        $or: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId }
        ],
        deletedBy: { $ne: currentUserId }
      },
      { $push: { deletedBy: currentUserId } }
    );

    // Check if all participants have deleted the conversation
    const allParticipantsDeleted = conversation.participants.every(p => 
      conversation.deletedBy.includes(p.toString())
    );

    if (allParticipantsDeleted) {
      // Full delete from database and Cloudinary
      const messagesToDelete = await Message.find({
        $or: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId }
        ]
      });

      for (const msg of messagesToDelete) {
        if (msg.filePublicId) {
          try {
            await cloudinary.uploader.destroy(msg.filePublicId, { resource_type: msg.fileType === 'image' ? 'image' : 'raw' });
          } catch (err) {
            console.error('Cloudinary delete failed:', err);
          }
        }
      }

      await Message.deleteMany({
        $or: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId }
        ]
      });
      await Conversation.findByIdAndDelete(conversation._id);
      return res.json({ message: 'Chat fully deleted from database' });
    } else {
      await conversation.save();
      res.json({ message: 'Chat removed for you' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit a specific message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const currentUserId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== currentUserId) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a specific message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Add to deletedBy
    if (!message.deletedBy.includes(currentUserId)) {
      message.deletedBy.push(currentUserId);
    }

    // If both participants deleted it, remove from DB
    // We need to know who the participants are. 
    // In Message model we have senderId and receiverId.
    const participants = [message.senderId.toString(), message.receiverId.toString()];
    const allDeleted = participants.every(p => message.deletedBy.includes(p));

    if (allDeleted) {
      if (message.filePublicId) {
        try {
          await cloudinary.uploader.destroy(message.filePublicId, { resource_type: message.fileType === 'image' ? 'image' : 'raw' });
        } catch (err) {
          console.error('Cloudinary delete failed:', err);
        }
      }
      await Message.findByIdAndDelete(messageId);
    } else {
      await message.save();
    }

    // Update conversation lastMessage if message was the last one
    const conversation = await Conversation.findOne({
      participants: { $all: [message.senderId, message.receiverId] }
    });

    if (conversation && conversation.lastMessage?.toString() === messageId) {
      const nextLastMessage = await Message.findOne({
        $or: [
          { senderId: message.senderId, receiverId: message.receiverId },
          { senderId: message.receiverId, receiverId: message.senderId }
        ],
        _id: { $ne: messageId },
        deletedBy: { $nin: [currentUserId] }
      }).sort({ createdAt: -1 });

      conversation.lastMessage = nextLastMessage ? nextLastMessage._id : null;
      await conversation.save();
    }

    res.json({ message: allDeleted ? 'Message fully deleted' : 'Message deleted for you' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  getConversations, 
  getOrCreateConversation, 
  getMessages, 
  sendMessage, 
  deleteChat,
  editMessage,
  deleteMessage
};

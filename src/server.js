require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic route
app.get('/', (req, res) => {
  res.send('Bridge API is running...');
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Store online users: userId -> socketId
let onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins with their MongoDB _id
  socket.on('join', (userId) => {
    onlineUsers.set(userId, socket.id);
    // Broadcast updated online user list
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    console.log(`User ${userId} is now online. Total online: ${onlineUsers.size}`);
  });

  // Handle sending messages in real-time
  socket.on('sendMessage', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receiveMessage', data);
    }
  });

  // Handle typing indicators
  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', { senderId });
    }
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userStopTyping', { senderId });
    }
  });

  // Message edits/deletions
  socket.on('editMessage', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('messageUpdated', data);
    }
  });

  socket.on('deleteMessage', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('messageDeleted', data);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    let disconnectedUserId = null;
    for (let [key, value] of onlineUsers.entries()) {
      if (value === socket.id) {
        disconnectedUserId = key;
        onlineUsers.delete(key);
        break;
      }
    }
    if (disconnectedUserId) {
      // Broadcast updated online user list
      io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

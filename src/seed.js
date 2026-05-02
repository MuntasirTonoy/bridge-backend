require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const connectDB = require('./config/db');

// Add users from dummy data
const contacts = [
  {
    name: "Elena Rostova",
    username: "elena.rostova",
    email: "elena@ethereal.ui",
    password: "password123",
    location: "Moscow, Russia",
    profilePic: "https://api.dicebear.com/7.x/adventurer/svg?seed=Elena&backgroundColor=b6e3f4",
    isOnline: true,
    bio: "Passionate about creating intuitive user experiences. Currently exploring the intersection of motion design and accessibility.",
  },
  {
    name: "Marcus Hale",
    username: "marcus.hale",
    email: "marcus@ethereal.ui",
    password: "password123",
    location: "San Francisco, CA",
    profilePic: "https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus&backgroundColor=c0aede",
    isOnline: false,
    bio: "Crafting calm interfaces. Currently obsessing over typography and negative space.",
  },
  {
    name: "Alex Chen",
    username: "alexchen.dev",
    email: "alex@codebridge.io",
    password: "password123",
    location: "Singapore",
    profilePic: "https://api.dicebear.com/7.x/adventurer/svg?seed=AlexChen&backgroundColor=d1d4f9",
    isOnline: true,
    bio: "Building bridges between design and code. React enthusiast and coffee addict.",
  },
  {
    name: "Sarah Jenkins",
    username: "sarahjenkins",
    email: "sarah@productco.io",
    password: "password123",
    location: "London, UK",
    profilePic: "https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah&backgroundColor=ffd5dc",
    isOnline: true,
    bio: "Turning user pain into product gain. Obsessed with roadmaps and sticky notes.",
  },
  {
    name: "David Kim",
    username: "davidkim.io",
    email: "david@techstack.dev",
    password: "password123",
    location: "Seoul, South Korea",
    isOnline: false,
    bio: "APIs and microservices are my art form. Currently diving deep into Rust and distributed systems.",
  },
  {
    name: "Chloe Smith",
    username: "chloe.smith",
    email: "chloe@brandlab.co",
    password: "password123",
    location: "New York, NY",
    isOnline: false,
    bio: "Words that work. Crafting brand voices that resonate and convert.",
  },
];

const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Clear existing data
    await User.deleteMany();
    await Message.deleteMany();
    await Conversation.deleteMany();

    // Hash passwords before inserting
    const salt = await bcrypt.genSalt(10);
    const usersWithHashedPasswords = await Promise.all(
      contacts.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, salt),
      }))
    );

    // Insert Users
    const insertedUsers = await User.insertMany(usersWithHashedPasswords);
    console.log('Users Seeded!');

    // Get the first user to act as "me" for creating some messages
    const me = insertedUsers[0]; // Elena
    const marcus = insertedUsers[1];
    const alex = insertedUsers[2];
    const sarah = insertedUsers[3];

    // Create messages between Elena and Marcus
    const messages1 = [
      {
        senderId: marcus._id,
        receiverId: me._id,
        text: "The new mockups look incredible. I really love the atmospheric depth we're getting with those tonal shifts.",
      },
      {
        senderId: me._id,
        receiverId: marcus._id,
        text: "Thanks! I think ditching the hard borders really opened up the space. The 'Ghost Border' trick is working well for accessibility too.",
      },
      {
        senderId: marcus._id,
        receiverId: me._id,
        text: "Agreed. Have you had a chance to look at the animation curves for the sidebar transitions?",
      },
      {
        senderId: marcus._id,
        receiverId: me._id,
        text: "We might need to slow them down just a touch to match the 'calm' vibe.",
      },
    ];

    // Create messages between Elena and Alex
    const messages2 = [
      {
        senderId: me._id,
        receiverId: alex._id,
        text: "Hey Alex, the PR is ready for review when you get a chance.",
      },
      {
        senderId: alex._id,
        receiverId: me._id,
        text: "On it! Give me 20 minutes.",
      },
      {
        senderId: alex._id,
        receiverId: me._id,
        text: "Left a few comments — mostly nits. LGTM overall 🚀",
      },
    ];

    // Create messages between Elena and Sarah
    const messages3 = [
      {
        senderId: sarah._id,
        receiverId: me._id,
        text: "Sprint planning is tomorrow at 10 AM. Can you prepare the velocity chart?",
      },
      {
        senderId: me._id,
        receiverId: sarah._id,
        text: "Sure, I'll have it ready by EOD today.",
      },
    ];

    const allMessages1 = await Message.insertMany(messages1);
    const allMessages2 = await Message.insertMany(messages2);
    const allMessages3 = await Message.insertMany(messages3);
    console.log('Messages Seeded!');

    // Create conversations
    await Conversation.create({
      participants: [me._id, marcus._id],
      lastMessage: allMessages1[allMessages1.length - 1]._id,
      lastUpdated: new Date(),
    });

    await Conversation.create({
      participants: [me._id, alex._id],
      lastMessage: allMessages2[allMessages2.length - 1]._id,
      lastUpdated: new Date(Date.now() - 60000), // 1 min ago
    });

    await Conversation.create({
      participants: [me._id, sarah._id],
      lastMessage: allMessages3[allMessages3.length - 1]._id,
      lastUpdated: new Date(Date.now() - 120000), // 2 min ago
    });

    console.log('Conversations Seeded!');

    console.log('\n--- Seeded Users (login with password: password123) ---');
    insertedUsers.forEach(u => {
      console.log(`  ${u.name} — ${u.email}`);
    });

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedDatabase();

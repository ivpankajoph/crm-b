import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notification from './src/models/Notification.js';
import User from './src/models/User.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = await User.find();
  if (users.length > 0) {
    await Notification.create({
      title: 'Welcome to Antigravity CRM!',
      message: 'This is a test notification to show you that the notification system is working perfectly. You can mark this as read or delete it.',
      type: 'success',
      user: users[0]._id
    });
    console.log('Seed successful');
  }
  process.exit(0);
}).catch(console.error);

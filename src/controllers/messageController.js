import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Get users for messaging
// @route   GET /api/messages/users
// @access  Private
export const getUsersForMessaging = async (req, res) => {
  try {
    // Get all users except the current one
    const users = await User.find({ _id: { $ne: req.user._id } }).select(
      '_id name email role profilePicture'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};

// @desc    Get messages between logged in user and selected user
// @route   GET /api/messages/:userId
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.user._id;

    if (!recipientId || !content) {
      return res.status(400).json({ message: 'Recipient and content are required' });
    }

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      content,
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error while sending message' });
  }
};

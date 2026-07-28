import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index(
  { sender: 1, recipient: 1, createdAt: -1 },
  { name: 'message_sender_recipient_createdAt' },
);
messageSchema.index(
  { recipient: 1, sender: 1, createdAt: -1 },
  { name: 'message_recipient_sender_createdAt' },
);

const Message = mongoose.model('Message', messageSchema);

export default Message;

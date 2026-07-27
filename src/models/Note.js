import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    default: '#fef3c7', // Tailwind amber-100 equivalent for sticky note
  },
  isSticky: {
    type: Boolean,
    default: false,
  },
  positionX: {
    type: Number,
    default: 0,
  },
  positionY: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

noteSchema.index({ createdBy: 1, isSticky: 1, createdAt: -1 });

const Note = mongoose.model('Note', noteSchema);

export default Note;

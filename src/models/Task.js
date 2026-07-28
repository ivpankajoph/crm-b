import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Todo', 'In Progress', 'Done'],
    default: 'Todo',
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
  },
  dueDate: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

taskSchema.index({ createdBy: 1, dueDate: 1 });
taskSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
taskSchema.index({ createdBy: 1, createdAt: -1 });
taskSchema.index({ createdBy: 1, status: 1, dueDate: 1 }, { name: 'task_owner_status_dueDate' });

const Task = mongoose.model('Task', taskSchema);

export default Task;

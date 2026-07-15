import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    level: {
      type: String,
      required: true,
    },
    usersCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permissions: [{
      type: String,
    }]
  },
  {
    timestamps: true,
  }
);

const Role = mongoose.model('Role', roleSchema);

export default Role;

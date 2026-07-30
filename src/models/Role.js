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
    }],
    grants: [{
      type: String,
      trim: true,
    }],
    dataScopes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    permissionVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

roleSchema.index({ status: 1, level: 1 });

const Role = mongoose.model('Role', roleSchema);

export default Role;

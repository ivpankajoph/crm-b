import mongoose from 'mongoose';
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      required: true,
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);



// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return enteredPassword === this.password;
};

// Return password when returning user object (as requested)
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;

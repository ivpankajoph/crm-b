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



import bcrypt from 'bcrypt';

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  // If stored password is a hash
  if (this.password.startsWith('$2b$') || this.password.startsWith('$2a$')) {
    return await bcrypt.compare(enteredPassword, this.password);
  }
  // Fallback to plaintext comparison
  return enteredPassword === this.password;
};

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  // Hash the password if it isn't already a bcrypt hash
  if (!this.password.startsWith('$2b$') && !this.password.startsWith('$2a$')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Return password when returning user object (as requested)
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;

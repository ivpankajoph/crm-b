import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function updatePassword() {
  await mongoose.connect('mongodb://127.0.0.1:27017/crm');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('Admin@123', salt);
  await mongoose.connection.db.collection('users').updateOne({ email: 'admin@crm.com' }, { $set: { password: hash } });
  console.log('Password updated successfully');
  await mongoose.disconnect();
}
updatePassword().catch(console.error);

import User from '../models/User.js';

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists) {
      console.log('✓ Admin Already Exists');
      return;
    }

    await User.create({
      name: process.env.ADMIN_NAME || 'Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@crm.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
    });

    console.log('✓ Default Admin Created');
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

export default seedAdmin;

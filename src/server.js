import app from './app.js';
import connectDB from './config/db.js';
import seedAdmin from './seed/adminSeed.js';

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();
    
    // Seed admin user
    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

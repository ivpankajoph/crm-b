import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { configureMongoDiagnostics } from '../utils/queryDiagnostics.js';

dotenv.config();

const connectDB = async () => {
  try {
    configureMongoDiagnostics(mongoose);
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: process.env.NODE_ENV !== 'production'
        || String(process.env.MONGO_AUTO_INDEX || '').toLowerCase() === 'true',
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

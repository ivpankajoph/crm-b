import mongoose from 'mongoose'; 
import dotenv from 'dotenv'; 
import Note from './src/models/Note.js'; 
dotenv.config(); 

mongoose.connect(process.env.MONGODB_URI).then(async () => { 
  await Note.updateMany({ isSticky: true }, { positionX: 100, positionY: 100 }); 
  console.log('Reset complete'); 
  process.exit(0); 
}).catch(console.error);

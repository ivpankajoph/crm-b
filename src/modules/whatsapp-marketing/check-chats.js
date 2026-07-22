import mongoose from "mongoose";
import { connectToMongoDB } from "./server/modules/storage/mongodb.adapter.js";
async function checkChats() {
  await connectToMongoDB();
  const db = mongoose.connection.db;
  if (!db) return;
  const chats = await db.collection("chats").find().sort({ lastMessageTime: -1 }).limit(5).toArray();
  console.log("Recent chats:");
  chats.forEach((c) => console.log(JSON.stringify(c, null, 2)));
  process.exit(0);
}
checkChats();

import app from './app.js';
import connectDB from './config/db.js';
import seedAdmin from './seed/adminSeed.js';
import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();
    
    // Seed admin user
    await seedAdmin();

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    const userSockets = new Map();

    io.on('connection', (socket) => {
      socket.on('register', (userId) => {
        userSockets.set(userId, socket.id);
      });

      socket.on('send_message', (data) => {
        const { recipientId, message } = data;
        const recipientSocket = userSockets.get(recipientId);
        if (recipientSocket) {
          io.to(recipientSocket).emit('receive_message', message);
        }
      });

      socket.on('disconnect', () => {
        for (const [key, value] of userSockets.entries()) {
          if (value === socket.id) {
            userSockets.delete(key);
            break;
          }
        }
      });
    });

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();


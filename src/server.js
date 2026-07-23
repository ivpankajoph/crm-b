import app from './app.js';
import connectDB from './config/db.js';
import seedAdmin from './seed/adminSeed.js';
import http from 'http';
import { Server } from 'socket.io';
import { startEmailMarketingRuntime } from './modules/email-marketing/services/emailQueueService.js';
import { startEmailMarketingAutomationRuntime } from './modules/email-marketing/services/automationQueueService.js';

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();
    
    // Seed admin user
    await seedAdmin();
    await startEmailMarketingRuntime().catch((error) => {
      console.error(
        '[Email Marketing] Background runtime could not start:',
        error.message,
      );
    });
    await startEmailMarketingAutomationRuntime().catch((error) => {
      console.error(
        '[Email Marketing] Automation runtime could not start:',
        error.message,
      );
    });

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


import app from './app.js';
import connectDB from './config/db.js';
import seedAdmin from './seed/adminSeed.js';
import http from 'http';
import { Server } from 'socket.io';
import { startEmailMarketingRuntime } from './modules/email-marketing/services/emailQueueService.js';
import { startEmailMarketingAutomationRuntime } from './modules/email-marketing/services/automationQueueService.js';
import { configureRealtime } from './services/realtimeService.js';
import { startFollowUpReminderRuntime } from './services/followUpReminderService.js';

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
    configureRealtime(io, userSockets);

    io.on('connection', (socket) => {
      socket.on('register', (userId) => {
        if (!userId) return;
        const key = String(userId);
        const sockets = userSockets.get(key) || new Set();
        sockets.add(socket.id);
        userSockets.set(key, sockets);
      });

      socket.on('send_message', (data) => {
        const { recipientId, message } = data;
        const recipientSockets = userSockets.get(String(recipientId));
        if (recipientSockets) {
          for (const socketId of recipientSockets) {
            io.to(socketId).emit('receive_message', message);
          }
        }
      });

      socket.on('disconnect', () => {
        for (const [key, sockets] of userSockets.entries()) {
          sockets.delete(socket.id);
          if (sockets.size === 0) userSockets.delete(key);
        }
      });
    });

    await startFollowUpReminderRuntime().catch((error) => {
      console.error('[FollowUpScheduler] Runtime could not start:', error.message);
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


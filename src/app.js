import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { protect } from './middleware/authMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import telephonyRoutes from './routes/telephonyRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';

dotenv.config();

// The shared WhatsApp module uses this name; CRM already connects with
// MONGODB_URI, so both applications intentionally use the same database.
process.env.MONGODB_URL ||= process.env.MONGODB_URI;
const { default: whatsappMarketingRouter } = await import(
  '../../sellerslogin-backend/modules/whatsapp-marketing/index.js'
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const bridgeCrmUserToWhatsApp = (req, res, next) => {
  if (req.path.startsWith('/webhook/whatsapp')) return next();
  return protect(req, res, () => {
    const crmUser = req.user;
    const normalizedRole = ['admin', 'superadmin', 'super_admin'].includes(
      String(crmUser?.role || '').toLowerCase()
    ) ? 'admin' : 'user';
    const whatsappUser = {
      id: `crm:${crmUser._id}`,
      accountId: String(crmUser._id),
      username: crmUser.email || `crm_${crmUser._id}`,
      name: crmUser.name || 'CRM User',
      email: crmUser.email || '',
      role: normalizedRole,
      pageAccess: crmUser.permissions || [],
    };
    req.headers['x-user-id'] = whatsappUser.id;
    req.headers['x-user-role'] = whatsappUser.role;
    req.headers['x-user-name'] = whatsappUser.name;
    req.headers['x-user'] = JSON.stringify(whatsappUser);
    next();
  });
};

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'https://crm.sellerslogin.com',
  'http://crm.sellerslogin.com',
];

const normalizeOrigin = (origin) => origin?.trim().replace(/\/$/, '');

const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...(process.env.CLIENT_ORIGIN || '').split(','),
]
  .map(normalizeOrigin)
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-user-name', 'x-user'],
  optionsSuccessStatus: 204,
};

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Security and utility middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/telephony', telephonyRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/whatsapp-marketing', bridgeCrmUserToWhatsApp, whatsappMarketingRouter);

// Root route
app.get('/', (req, res) => {
  res.send('CRM API is running...');
});

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

export default app;

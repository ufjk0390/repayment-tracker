import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import pairingRoutes from './routes/pairing.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import categoryRoutes from './routes/category.routes.js';
import debtRoutes from './routes/debt.routes.js';
import planRoutes from './routes/plan.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import reportRoutes from './routes/report.routes.js';

const app = express();

// Global middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(generalLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve('uploads')));

// Root info
app.get('/', (req, res) => {
  res.json({
    name: '富盛典藏 API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/health',
    endpoints: {
      auth: '/api/v1/auth',
      pairing: '/api/v1/pairing',
      transactions: '/api/v1/transactions',
      debts: '/api/v1/debts',
      plans: '/api/v1/plans',
      budgets: '/api/v1/budgets',
      reports: '/api/v1/reports',
      dashboard: '/api/v1/dashboard',
      notifications: '/api/v1/notifications',
      upload: '/api/v1/upload',
    },
    frontend: 'http://localhost:5173',
  });
});

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pairing', pairingRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/debts', debtRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`,
    },
  });
});

// Global error handler
app.use(errorHandler);

export default app;

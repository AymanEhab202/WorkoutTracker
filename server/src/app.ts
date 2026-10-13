import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/authRoutes';
import exerciseRoutes from './routes/exerciseRoutes';
import templateRoutes from './routes/templateRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import sessionRoutes from './routes/sessionRoutes';
import bodyWeightRoutes from './routes/bodyWeightRoutes';
import goalRoutes from './routes/goalRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import backupRoutes from './routes/backupRoutes';

import { requireAuth } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '20mb' })); // Support JSON backup import
  app.use(cookieParser());
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use('/api', apiLimiter);

  // Public auth routes (status, setup, login, logout)
  app.use('/api/auth', authRoutes);

  // Protected API routes
  app.use('/api/exercises', requireAuth, exerciseRoutes);
  app.use('/api/templates', requireAuth, templateRoutes);
  app.use('/api/schedule', requireAuth, scheduleRoutes);
  app.use('/api/sessions', requireAuth, sessionRoutes);
  app.use('/api/body-weight', requireAuth, bodyWeightRoutes);
  app.use('/api/goals', requireAuth, goalRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/backup', requireAuth, backupRoutes);

  // Serve static client assets if built
  let clientDist = path.resolve(__dirname, '../../client/dist');
  if (!fs.existsSync(clientDist)) {
    clientDist = path.resolve(process.cwd(), 'client/dist');
  }
  if (!fs.existsSync(clientDist)) {
    clientDist = path.resolve(process.cwd(), '../client/dist');
  }
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Central error handling
  app.use(errorHandler);

  return app;
}

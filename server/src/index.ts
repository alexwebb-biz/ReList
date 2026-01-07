import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });

// Import routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import alertsRoutes from './routes/alerts.js';
import resultsRoutes from './routes/results.js';
import inventoryRoutes from './routes/inventory.js';
import userRoutes from './routes/user.js';
import uploadRoutes from './routes/upload.js';
import notificationsRoutes from './routes/notifications.js';
import stripeRoutes from './routes/stripe.js';
import telegramRoutes from './routes/telegram.js';

// Import services
import { startScheduler } from './services/schedulerService.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

// Socket.IO setup for real-time notifications
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Store socket connections by user ID
const userSockets = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('authenticate', (userId: string) => {
    userSockets.set(userId, socket.id);
    console.log(`User ${userId} authenticated with socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    // Remove user from map
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Export function to send real-time notifications
export const sendRealTimeNotification = (userId: string, notification: any) => {
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit('notification', notification);
  }
};

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Raw body for Stripe webhooks (must be before express.json())
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/telegram', telegramRoutes);

// Serve static files from Vite build in production
if (process.env.NODE_ENV === 'production') {
  // Use process.cwd() since tsx runs from project root
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));

  // Handle client-side routing - serve index.html for non-API routes
  // Express 5 uses {*path} syntax instead of *
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         ReList API Server                  ║
  ╠═══════════════════════════════════════════╣
  ║  Status:  Running                          ║
  ║  Port:    ${PORT}                            ║
  ║  Mode:    ${process.env.NODE_ENV || 'development'}                   ║
  ╚═══════════════════════════════════════════╝

  Endpoints:
  - Health:        http://localhost:${PORT}/api/health
  - Auth:          http://localhost:${PORT}/api/auth
  - Alerts:        http://localhost:${PORT}/api/alerts
  - Results:       http://localhost:${PORT}/api/results
  - Inventory:     http://localhost:${PORT}/api/inventory
  - User:          http://localhost:${PORT}/api/user
  - Upload:        http://localhost:${PORT}/api/upload
  - Notifications: http://localhost:${PORT}/api/notifications
  - Stripe:        http://localhost:${PORT}/api/stripe
  - Telegram:      http://localhost:${PORT}/api/telegram
  `);

  // Start the scheduler for background jobs
  if (process.env.ENABLE_SCHEDULER !== 'false') {
    try {
      startScheduler();
    } catch (err) {
      console.log('Scheduler not started (Redis may not be configured)');
    }
  }
});

export { io };
export default app;

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { connectDatabase } = require('./config/database');
const { initAgentSocket } = require('./services/agentSocket');
const logger = require('./services/logger');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const alertRoutes = require('./routes/alerts');

const app = express();

// ── Security Middleware ──
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, curl, agents)
    if (!origin) return callback(null, true);
    if (config.cors.origin.includes(origin) || config.cors.origin.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Rate Limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);

// ── Health Check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'opersis-assist', uptime: process.uptime() });
});

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/alerts', alertRoutes);

// ── 404 Handler ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error Handler ──
app.use(errorHandler);

// ── Start ──
async function start() {
  await connectDatabase();

  // Auto-seed super-admin on first boot
  try {
    const seed = require('./scripts/seed');
    await seed();
  } catch (err) {
    logger.warn('Seed skipped:', err.message);
  }

  const server = http.createServer(app);

  // Initialize WebSocket servers (agent + dashboard)
  initAgentSocket(server);

  server.listen(config.port, config.host, () => {
    logger.info(`Opersis Assist server running on ${config.host}:${config.port}`);
    logger.info(`Environment: ${config.env}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

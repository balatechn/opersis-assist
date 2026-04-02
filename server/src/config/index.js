require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  host: process.env.HOST || '0.0.0.0',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/opersis-assist',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  agent: {
    secret: process.env.AGENT_SECRET || 'dev-agent-secret-change-in-production',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim()),
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;

const Redis = require('ioredis');
const config = require('./index');
const logger = require('../services/logger');

let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error('Redis error:', err.message));
  }
  return redis;
}

module.exports = { getRedis };

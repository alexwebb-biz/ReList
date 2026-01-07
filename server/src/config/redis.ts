import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Check if Redis is configured
const redisHost = process.env.REDIS_HOST;
const isRedisConfigured = !!redisHost;

// Detect if using Upstash (requires TLS)
const isUpstash = redisHost?.includes('upstash.io');

// Redis connection configuration
const redisConfig: any = {
  host: redisHost || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: isRedisConfigured ? undefined : () => null,
};

// Enable TLS for Upstash
if (isUpstash) {
  redisConfig.tls = {};
}

// Create Redis connection only if configured
let redis: Redis | null = null;

if (isRedisConfigured) {
  redis = new Redis(redisConfig);

  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });

  redis.on('ready', () => {
    console.log('Redis ready to accept commands');
  });

  redis.on('error', (err: Error) => {
    console.error('Redis connection error:', err.message);
  });
} else {
  console.log('Redis not configured - job queue features disabled');
}

export { redis };

// Export config for BullMQ (needs separate connection)
export const bullConnection = isRedisConfigured ? {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  tls: isUpstash ? {} : undefined,
} : null;

export const isRedisEnabled = (): boolean => isRedisConfigured && redis !== null;

export default redis;

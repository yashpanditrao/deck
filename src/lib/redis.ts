import Redis from 'ioredis';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set. Please configure your Redis Cloud connection.');
}

const globalForRedis = global as unknown as {
  redis: Redis | undefined;
};

let redisClient: Redis;

function createRedisClient(): Redis {
  console.log('🔌 Initializing Redis Cloud connection...');
  
  return new Redis(process.env.REDIS_URL as string, {
    tls: {},
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
    connectTimeout: 10000, // 10 seconds
    retryStrategy: (times) => {
      if (times > 5) {
        console.error('❌ Max Redis connection retries reached');
        return null; // Stop retrying after 5 attempts
      }
      const delay = Math.min(times * 1000, 10000); // Exponential backoff up to 10s
      console.log(`⏳ Redis connection attempt ${times}, retrying in ${delay}ms...`);
      return delay;
    },
  });
}

if (!globalForRedis.redis) {
  redisClient = createRedisClient();
  
  redisClient.on('connect', () => {
    console.log('✅ Successfully connected to Redis Cloud');
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Cloud Error:', err.message);
  });

  // Cache the client in development and production
  globalForRedis.redis = redisClient;
} else {
  redisClient = globalForRedis.redis;
}

export default redisClient;

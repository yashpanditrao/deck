import Redis from 'ioredis';

const globalForRedis = global as unknown as {
  redis: Redis | undefined;
};

const redisClient =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL as string, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

if (!globalForRedis.redis) {
  globalForRedis.redis = redisClient;
  console.log('⬢ Redis client initialized');
}

export default redisClient;

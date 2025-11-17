import Redis from 'ioredis';

type RedisClient = Redis | null;

// This prevents multiple instances of the Redis client in development
const globalWithRedis = global as typeof globalThis & {
  _redisClient?: RedisClient;
};

let redisClient: RedisClient;
let redisPromise: Promise<Redis>;

async function getRedisClient(): Promise<Redis> {
  // If we're in the browser, throw a helpful error
  if (typeof window !== 'undefined') {
    throw new Error('Redis client cannot be used in the browser');
  }

  // In development, use the global instance if it exists
  if (process.env.NODE_ENV === 'development' && globalWithRedis._redisClient) {
    return globalWithRedis._redisClient;
  }

  // If we already have a client, return it
  if (redisClient) {
    return redisClient;
  }

  // If we're already creating a client, return the promise
  if (redisPromise) {
    return redisPromise;
  }

  // Create a new Redis client
  redisPromise = (async () => {
    try {
      // Only check for REDIS_URL when actually trying to connect
      if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL environment variable is not set. Please configure your Redis Cloud connection.');
      }

      console.log('🔌 Initializing Redis Cloud connection...');
      
      const client = new Redis(process.env.REDIS_URL, {
        tls: {},
        maxRetriesPerRequest: 5,
        enableReadyCheck: true,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          if (times > 5) {
            console.error('❌ Max Redis connection retries reached');
            return null;
          }
          const delay = Math.min(times * 1000, 10000);
          console.log(`⏳ Redis connection attempt ${times}, retrying in ${delay}ms...`);
          return delay;
        },
      });

      // Set up event listeners
      client.on('connect', () => {
        console.log('✅ Successfully connected to Redis Cloud');
      });

      client.on('error', (err) => {
        console.error('❌ Redis Cloud Error:', err.message);
      });

      // Cache the client
      redisClient = client;
      
      // In development, store the client in the global object
      if (process.env.NODE_ENV === 'development') {
        globalWithRedis._redisClient = client;
      }

      return client;
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      throw error;
    }
  })();

  return redisPromise;
}

// Export the function to get the Redis client
export default getRedisClient;

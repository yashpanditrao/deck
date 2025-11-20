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

  // Helper to check if client is usable
  const isClientUsable = (client: RedisClient) => {
    return client && client.status !== 'end';
  };

  // In development, use the global instance if it exists and is usable
  if (process.env.NODE_ENV === 'development' && globalWithRedis._redisClient) {
    if (isClientUsable(globalWithRedis._redisClient)) {
      return globalWithRedis._redisClient!;
    }
    // If existing client is closed, clear it
    console.log('⚠️ Global Redis client is closed, creating new connection...');
    globalWithRedis._redisClient = null;
    redisClient = null;
    redisPromise = undefined as unknown as Promise<Redis>;
  }

  // If we already have a local usable client, return it
  if (redisClient && isClientUsable(redisClient)) {
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

      const isTls = process.env.REDIS_URL.startsWith('rediss://');
      const options: {
        maxRetriesPerRequest: number;
        enableReadyCheck: boolean;
        connectTimeout: number;
        lazyConnect: boolean;
        maxLoadingRetryTime: number;
        retryStrategy: (times: number) => number | null;
        tls?: Record<string, unknown>;
      } = {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000,
        lazyConnect: false,
        // Prevent memory leaks from connection pooling
        maxLoadingRetryTime: 10000,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error('❌ Max Redis connection retries reached');
            // Clear the promise to allow fresh retry
            redisPromise = undefined as unknown as Promise<Redis>;
            redisClient = null;
            if (process.env.NODE_ENV === 'development') {
              globalWithRedis._redisClient = undefined;
            }
            return null;
          }
          const delay = Math.min(times * 1000, 5000);
          console.log(`⏳ Redis connection attempt ${times}, retrying in ${delay}ms...`);
          return delay;
        },
      };

      if (isTls) {
        options.tls = {};
      }

      const client = new Redis(process.env.REDIS_URL, options);

      // Set up event listeners
      client.on('connect', () => {
        console.log('✅ Successfully connected to Redis Cloud');
      });

      client.on('error', (err) => {
        console.error('❌ Redis Cloud Error:', err.message);
      });

      client.on('end', () => {
        console.log('🔌 Redis connection closed');
        // Clear cache so next request tries to reconnect
        redisClient = null;
        if (process.env.NODE_ENV === 'development') {
          globalWithRedis._redisClient = undefined;
        }
        redisPromise = undefined as unknown as Promise<Redis>;
      });

      client.on('close', () => {
        console.log('🔌 Redis connection closed unexpectedly');
        // Clear cache to prevent memory leak
        redisClient = null;
        if (process.env.NODE_ENV === 'development') {
          globalWithRedis._redisClient = undefined;
        }
        redisPromise = undefined as unknown as Promise<Redis>;
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
      redisPromise = undefined as unknown as Promise<Redis>; // Reset promise on failure
      throw error;
    }
  })();

  return redisPromise;
}

// Export the function to get the Redis client
export default getRedisClient;

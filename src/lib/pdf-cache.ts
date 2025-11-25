import getRedisClient from './redis';

const PDF_CACHE_PREFIX = 'pdf:cache:';
const TWO_WEEKS_IN_SECONDS = 14 * 24 * 60 * 60; // 14 days

/**
 * Cache a PDF file in Redis
 * @param filePath - The file path identifier
 * @param buffer - The PDF buffer to cache
 * @param ttl - Time to live in seconds (default: 2 weeks)
 */
export async function cachePDF(
  filePath: string,
  buffer: Buffer,
  ttl: number = TWO_WEEKS_IN_SECONDS
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const cacheKey = `${PDF_CACHE_PREFIX}${filePath}`;
    
    // Store the buffer as binary data in Redis
    await redis.setex(cacheKey, ttl, buffer);
    
    console.log(`✅ PDF cached: ${filePath} (${buffer.length} bytes, TTL: ${ttl}s)`);
  } catch (error) {
    console.error('Error caching PDF:', error);
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Retrieve a cached PDF from Redis
 * @param filePath - The file path identifier
 * @returns The cached PDF buffer or null if not found
 */
export async function getCachedPDF(filePath: string): Promise<Buffer | null> {
  try {
    const redis = await getRedisClient();
    const cacheKey = `${PDF_CACHE_PREFIX}${filePath}`;
    
    // Get the buffer from Redis
    const data = await redis.getBuffer(cacheKey);
    
    if (data) {
      console.log(`✅ Cache HIT: ${filePath} (${data.length} bytes)`);
      return data;
    }
    
    console.log(`❌ Cache MISS: ${filePath}`);
    return null;
  } catch (error) {
    console.error('Error retrieving cached PDF:', error);
    return null; // Return null on error to fall back to fetching from storage
  }
}

/**
 * Invalidate (delete) a cached PDF
 * @param filePath - The file path identifier
 */
export async function invalidatePDFCache(filePath: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    const cacheKey = `${PDF_CACHE_PREFIX}${filePath}`;
    
    await redis.del(cacheKey);
    console.log(`🗑️ PDF cache invalidated: ${filePath}`);
  } catch (error) {
    console.error('Error invalidating PDF cache:', error);
  }
}

/**
 * Get cache statistics for a PDF
 * @param filePath - The file path identifier
 * @returns Object with cache info (exists, ttl, size)
 */
export async function getPDFCacheInfo(filePath: string): Promise<{
  exists: boolean;
  ttl: number | null;
  size: number | null;
}> {
  try {
    const redis = await getRedisClient();
    const cacheKey = `${PDF_CACHE_PREFIX}${filePath}`;
    
    const exists = (await redis.exists(cacheKey)) === 1;
    const ttl = exists ? await redis.ttl(cacheKey) : null;
    
    let size = null;
    if (exists) {
      const data = await redis.getBuffer(cacheKey);
      size = data ? data.length : null;
    }
    
    return { exists, ttl, size };
  } catch (error) {
    console.error('Error getting PDF cache info:', error);
    return { exists: false, ttl: null, size: null };
  }
}

/**
 * Clear all PDF caches (use with caution)
 */
export async function clearAllPDFCaches(): Promise<number> {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(`${PDF_CACHE_PREFIX}*`);
    
    if (keys.length === 0) {
      console.log('No PDF caches to clear');
      return 0;
    }
    
    const deleted = await redis.del(...keys);
    console.log(`🗑️ Cleared ${deleted} PDF caches`);
    return deleted;
  } catch (error) {
    console.error('Error clearing all PDF caches:', error);
    return 0;
  }
}


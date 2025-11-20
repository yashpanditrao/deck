import getRedisClient from './redis';

/**
 * Redis-based OTP storage with rate limiting
 * 
 * Security Features:
 * - Rate limiting (max 5 attempts per token)
 * - Auto-expiration (via Redis TTL)
 * - One-time use
 * - Constant-time comparison
 * - Request rate limiting per email
 */

interface OTPData {
    code: string;
    email: string;
    expires: number;
    attempts: number; // Track failed attempts
}

const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_EMAIL = 3; // Max OTP requests per email per hour
const REQUEST_WINDOW = 60 * 60; // 1 hour in seconds

export const OTPStorage = {
    /**
     * Check if email has exceeded request rate limit
     */
    async checkRateLimit(email: string): Promise<{ allowed: boolean; remaining: number }> {
        const redis = await getRedisClient();
        const key = `otp:ratelimit:${email.toLowerCase()}`;
        const count = await redis.incr(key);

        if (count === 1) {
            // First request, set expiration
            await redis.expire(key, REQUEST_WINDOW);
        }

        const remaining = Math.max(0, MAX_REQUESTS_PER_EMAIL - count);
        return {
            allowed: count <= MAX_REQUESTS_PER_EMAIL,
            remaining
        };
    },

    /**
     * Store an OTP for a given token
     */
    async set(token: string, code: string, email: string, expiresInMs: number = 10 * 60 * 1000) {
        const redis = await getRedisClient();
        const data: OTPData = {
            code,
            email: email.toLowerCase(),
            expires: Date.now() + expiresInMs,
            attempts: 0
        };
        // Use setex for automatic expiration
        await redis.setex(`otp:${token}`, Math.ceil(expiresInMs / 1000), JSON.stringify(data));
    },

    /**
     * Get OTP data for a token
     */
    async get(token: string): Promise<OTPData | undefined> {
        const redis = await getRedisClient();
        const data = await redis.get(`otp:${token}`);
        return data ? JSON.parse(data) : undefined;
    },

    /**
     * Verify OTP with constant-time comparison and rate limiting
     * @returns { success: boolean, error?: string }
     */
    async verify(token: string, code: string, email: string): Promise<{ success: boolean; error?: string }> {
        const redis = await getRedisClient();
        const key = `otp:${token}`;
        const dataStr = await redis.get(key);

        if (!dataStr) {
            return { success: false, error: 'No verification code found. Please request a new code.' };
        }

        const data: OTPData = JSON.parse(dataStr);

        // Check expiration (double check in case Redis TTL hasn't fired yet)
        if (Date.now() > data.expires) {
            await redis.del(key);
            return { success: false, error: 'Verification code has expired. Please request a new code.' };
        }

        // Check rate limiting
        if (data.attempts >= MAX_ATTEMPTS) {
            await redis.del(key);
            return { success: false, error: 'Too many failed attempts. Please request a new code.' };
        }

        // Verify email matches
        if (data.email.toLowerCase() !== email.toLowerCase()) {
            data.attempts++;
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
                await redis.setex(key, ttl, JSON.stringify(data));
            }
            return { success: false, error: 'Email mismatch. Please use the email you requested the code with.' };
        }

        // Constant-time comparison to prevent timing attacks
        if (!constantTimeCompare(data.code, code)) {
            data.attempts++;
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
                await redis.setex(key, ttl, JSON.stringify(data));
            }
            return { success: false, error: 'Invalid verification code' };
        }

        // Success - delete OTP (one-time use)
        await redis.del(key);
        return { success: true };
    },

    /**
     * Delete OTP for a token
     */
    async delete(token: string): Promise<number> {
        const redis = await getRedisClient();
        return redis.del(`otp:${token}`);
    },

    /**
     * Check if OTP exists and is not expired
     */
    async isValid(token: string): Promise<boolean> {
        const redis = await getRedisClient();
        const exists = await redis.exists(`otp:${token}`);
        return exists === 1;
    }
};

/**
 * Constant-time string comparison to prevent timing attacks
 * This ensures that comparison time doesn't leak information about correct characters
 */
function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
}

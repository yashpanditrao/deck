/**
 * In-memory OTP storage with rate limiting
 * 
 * ⚠️ WARNING: This is for development/testing only!
 * In production, replace this with Redis or another distributed cache.
 * 
 * Security Features:
 * - Rate limiting (max 5 attempts per token)
 * - Auto-expiration (10 minutes)
 * - One-time use
 * - Constant-time comparison
 */

interface OTPData {
    code: string;
    email: string;
    expires: number;
    attempts: number; // Track failed attempts
}

// In-memory store (shared across request-code and confirm-code)
const otpStore = new Map<string, OTPData>();

// Rate limiting: Track failed attempts per token
const MAX_ATTEMPTS = 5;

export const OTPStorage = {
    /**
     * Store an OTP for a given token
     */
    set(token: string, code: string, email: string, expiresInMs: number = 10 * 60 * 1000) {
        otpStore.set(token, {
            code,
            email: email.toLowerCase(),
            expires: Date.now() + expiresInMs,
            attempts: 0
        });
    },

    /**
     * Get OTP data for a token
     */
    get(token: string): OTPData | undefined {
        return otpStore.get(token);
    },

    /**
     * Verify OTP with constant-time comparison and rate limiting
     * @returns { success: boolean, error?: string }
     */
    verify(token: string, code: string, email: string): { success: boolean; error?: string } {
        const data = otpStore.get(token);

        if (!data) {
            return { success: false, error: 'No verification code found. Please request a new code.' };
        }

        // Check expiration
        if (Date.now() > data.expires) {
            otpStore.delete(token);
            return { success: false, error: 'Verification code has expired. Please request a new code.' };
        }

        // Check rate limiting
        if (data.attempts >= MAX_ATTEMPTS) {
            otpStore.delete(token);
            return { success: false, error: 'Too many failed attempts. Please request a new code.' };
        }

        // Verify email matches
        if (data.email.toLowerCase() !== email.toLowerCase()) {
            data.attempts++;
            return { success: false, error: 'Email mismatch. Please use the email you requested the code with.' };
        }

        // Constant-time comparison to prevent timing attacks
        if (!constantTimeCompare(data.code, code)) {
            data.attempts++;
            return { success: false, error: 'Invalid verification code' };
        }

        // Success - delete OTP (one-time use)
        otpStore.delete(token);
        return { success: true };
    },

    /**
     * Delete OTP for a token
     */
    delete(token: string): boolean {
        return otpStore.delete(token);
    },

    /**
     * Check if OTP exists and is not expired
     */
    isValid(token: string): boolean {
        const data = otpStore.get(token);
        if (!data) return false;

        if (Date.now() > data.expires) {
            otpStore.delete(token); // Auto-cleanup expired
            return false;
        }

        return true;
    },

    /**
     * Clean up expired OTPs (call periodically)
     */
    cleanup() {
        const now = Date.now();
        for (const [token, data] of otpStore.entries()) {
            if (now > data.expires) {
                otpStore.delete(token);
            }
        }
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

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => OTPStorage.cleanup(), 5 * 60 * 1000);
}

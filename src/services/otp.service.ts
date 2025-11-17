// src/services/otp.service.ts
import crypto from 'crypto';
import redis from '@/lib/redis'; // your serverless-safe redis client (global patched)
import { Redis } from 'ioredis';

type OTPResult = { success: true; otp: string } | { success: false; error: string };
type VerificationResult = { success: true } | { success: false; error: string };

const OTP_EXPIRY = 15 * 60; // seconds
const OTP_ATTEMPTS_LIMIT = 5;
const OTP_ATTEMPTS_WINDOW = 60 * 60; // seconds (1 hour)
const OTP_LENGTH = 6;
const GENERATE_COOLDOWN = 30; // seconds - small throttle between generate calls
const GENERATE_LOCK_TTL = 5; // seconds - short lock to avoid concurrent generation

const genOTP = () =>
  crypto
    .randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');

/**
 * Lua script for atomic generate:
 * KEYS[1] = attemptsKey
 * KEYS[2] = otpKey
 * KEYS[3] = cooldownKey
 * ARGV[1] = otp (string)
 * ARGV[2] = otpExpiry (seconds)
 * ARGV[3] = attemptsLimit (number)
 * ARGV[4] = attemptsWindow (seconds)
 * ARGV[5] = cooldownSeconds (seconds)
 *
 * Returns:
 *  - ["OK", newAttempts] on success
 *  - ["LIMIT"] if attempts >= limit
 */
const GENERATE_LUA = `
local attempts = tonumber(redis.call('get', KEYS[1]) or '0')
local limit = tonumber(ARGV[3])
if attempts >= limit then
  return { "LIMIT" }
end

-- set otp with expiry
redis.call('set', KEYS[2], ARGV[1], 'EX', tonumber(ARGV[2]))

-- increment attempts and set expiry on attempts key
local newAttempts = redis.call('incr', KEYS[1])
redis.call('expire', KEYS[1], tonumber(ARGV[4]))

-- set cooldown so clients can't spam rapid generation
redis.call('set', KEYS[3], '1', 'EX', tonumber(ARGV[5]))

return { "OK", tostring(newAttempts) }
`;

/**
 * Lua script for atomic verify:
 * KEYS[1] = attemptsKey
 * KEYS[2] = otpKey
 * KEYS[3] = cooldownKey (optional; we will clear it on success)
 * ARGV[1] = providedCode
 * ARGV[2] = attemptsLimit
 * ARGV[3] = attemptsWindow
 *
 * Returns:
 *  - { "OK" } when verification succeeds (and deletes attempts+otp+cooldown)
 *  - { "NO_OTP" } when otp missing/expired (and increments attempts)
 *  - { "INVALID", newAttempts } when otp present but wrong (increments attempts)
 *  - { "LOCKED" } when attempts >= limit
 */
const VERIFY_LUA = `
local attempts = tonumber(redis.call('get', KEYS[1]) or '0')
local limit = tonumber(ARGV[2])
if attempts >= limit then
  return { "LOCKED" }
end

local stored = redis.call('get', KEYS[2])
if not stored then
  local newAttempts = redis.call('incr', KEYS[1])
  redis.call('expire', KEYS[1], tonumber(ARGV[3]))
  return { "NO_OTP", tostring(newAttempts) }
end

if stored ~= ARGV[1] then
  local newAttempts = redis.call('incr', KEYS[1])
  redis.call('expire', KEYS[1], tonumber(ARGV[3]))
  return { "INVALID", tostring(newAttempts) }
end

-- correct code: cleanup keys
redis.call('del', KEYS[2])
redis.call('del', KEYS[1])
redis.call('del', KEYS[3])
return { "OK" }
`;

/**
 * Generate OTP (hardened)
 * - short NX lock to avoid concurrent generate flows
 * - checks cooldown key
 * - atomically sets OTP and increments attempts using Lua
 */
export async function generateOTP(email: string, token: string): Promise<OTPResult> {
  if (!email || !token) {
    return { success: false, error: 'Email and token are required' };
  }

  const otpKey = `otp:${email}:${token}`;
  const attemptsKey = `otp_attempts:${email}:${token}`;
  const cooldownKey = `otp_cooldown:${email}:${token}`;
  const lockKey = `otp_lock:${email}:${token}`;

  try {
    // try acquire a very short lock (avoid parallelism)
    const lockAcquired = await redis.set(lockKey, '1', 'EX', GENERATE_LOCK_TTL, 'NX');
    if (!lockAcquired) {
      return { success: false, error: 'Generation in progress. Try again shortly.' };
    }

    // check cooldown quickly (non-atomic read is OK because we set cooldown in Lua below)
    const cooldownExists = await redis.exists(cooldownKey);
    if (cooldownExists) {
      // get ttl to provide useful message
      const ttl = await redis.ttl(cooldownKey);
      await redis.del(lockKey); // release lock early
      return { success: false, error: `Try again in ${ttl} seconds.` };
    }

    const otp = genOTP();

    // Run atomic Lua: check attempts < limit, set otp, incr attempts + expiry, set cooldown
    const res = (await (redis as Redis).eval(
      GENERATE_LUA,
      3,
      attemptsKey,
      otpKey,
      cooldownKey,
      otp,
      OTP_EXPIRY.toString(),
      OTP_ATTEMPTS_LIMIT.toString(),
      OTP_ATTEMPTS_WINDOW.toString(),
      GENERATE_COOLDOWN.toString()
    )) as string[] | null;

    // release lock
    await redis.del(lockKey);

    if (!res || res.length === 0) {
      return { success: false, error: 'Redis error during OTP generation' };
    }

    if (res[0] === 'LIMIT') {
      return { success: false, error: 'Too many OTP attempts. Please try again later.' };
    }

    // success
    return { success: true, otp };
  } catch (err) {
    // ensure lock removal on error (best-effort)
    try { await redis.del(lockKey); } catch (_) {}
    console.error('generateOTP error:', err);
    return { success: false, error: 'Failed to generate OTP' };
  }
}

/**
 * Verify OTP (hardened)
 * - atomic verify + attempts increment on failure via Lua
 */
export async function verifyOTP(email: string, token: string, code: string): Promise<VerificationResult> {
  if (!email || !token || !code) {
    return { success: false, error: 'Missing parameters' };
  }

  const attemptsKey = `otp_attempts:${email}:${token}`;
  const otpKey = `otp:${email}:${token}`;
  const cooldownKey = `otp_cooldown:${email}:${token}`;

  try {
    const res = (await (redis as Redis).eval(
      VERIFY_LUA,
      3,
      attemptsKey,
      otpKey,
      cooldownKey,
      code,
      OTP_ATTEMPTS_LIMIT.toString(),
      OTP_ATTEMPTS_WINDOW.toString()
    )) as string[] | null;

    if (!res || res.length === 0) {
      return { success: false, error: 'Redis error during verification' };
    }

    const tag = res[0];

    if (tag === 'LOCKED') {
      return { success: false, error: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (tag === 'NO_OTP') {
      // res[1] is newAttempts
      return { success: false, error: 'Invalid or expired OTP. Please request a new one.' };
    }

    if (tag === 'INVALID') {
      const newAttempts = parseInt(res[1] || '0', 10);
      const remaining = Math.max(0, OTP_ATTEMPTS_LIMIT - newAttempts);
      return { success: false, error: `Invalid OTP. ${remaining} attempts remaining.` };
    }

    if (tag === 'OK') {
      return { success: true };
    }

    return { success: false, error: 'Unknown verification response' };
  } catch (err) {
    console.error('verifyOTP error:', err);
    return { success: false, error: 'Failed to verify OTP' };
  }
}

/**
 * Clear OTP + attempts (admin / logout / test)
 */
export async function clearOTP(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  if (!email || !token) {
    return { success: false, error: 'Missing parameters' };
  }

  const otpKey = `otp:${email}:${token}`;
  const attemptsKey = `otp_attempts:${email}:${token}`;
  const cooldownKey = `otp_cooldown:${email}:${token}`;

  try {
    await redis.del(otpKey, attemptsKey, cooldownKey);
    return { success: true };
  } catch (err) {
    console.error('clearOTP error:', err);
    return { success: false, error: 'Failed to clear OTP' };
  }
}

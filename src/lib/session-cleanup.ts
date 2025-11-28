import { supabaseAdmin } from './supabase';
import getRedisClient from './redis';

/**
 * Cleanup utility for expired sessions and old data
 * Prevents server bloat by removing stale data
 */

const CLEANUP_AGE_DAYS = 30; // Clean up data older than 30 days
const INCOMPLETE_SESSION_AGE_HOURS = 24; // Clean up incomplete sessions older than 24 hours

/**
 * Clean up old analytics sessions
 * - Completed sessions older than CLEANUP_AGE_DAYS
 * - Incomplete sessions older than INCOMPLETE_SESSION_AGE_HOURS
 */
export async function cleanupAnalyticsSessions(): Promise<{
  deletedCompleted: number;
  deletedIncomplete: number;
}> {
  try {
    const now = new Date();
    const completedCutoff = new Date(now.getTime() - CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000);
    const incompleteCutoff = new Date(now.getTime() - INCOMPLETE_SESSION_AGE_HOURS * 60 * 60 * 1000);

    // Delete completed sessions older than CLEANUP_AGE_DAYS
    const { count: deletedCompleted } = await supabaseAdmin
      .from('deck_views')
      .delete()
      .eq('completed', true)
      .lt('ended_at', completedCutoff.toISOString());

    // Delete incomplete sessions older than INCOMPLETE_SESSION_AGE_HOURS
    const { count: deletedIncomplete } = await supabaseAdmin
      .from('deck_views')
      .delete()
      .eq('completed', false)
      .lt('created_at', incompleteCutoff.toISOString());

    return {
      deletedCompleted: deletedCompleted || 0,
      deletedIncomplete: deletedIncomplete || 0,
    };
  } catch (error) {
    console.error('Error cleaning up analytics sessions:', error);
    return { deletedCompleted: 0, deletedIncomplete: 0 };
  }
}

/**
 * Clean up old page views associated with deleted sessions
 */
export async function cleanupOrphanedPageViews(): Promise<number> {
  try {
    // Get all existing view IDs
    const { data: views } = await supabaseAdmin
      .from('deck_views')
      .select('id');

    if (!views || views.length === 0) {
      // If no views exist, delete all page views older than 30 days
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count } = await supabaseAdmin
        .from('page_views')
        .delete()
        .lt('viewed_at', cutoff.toISOString());
      return count || 0;
    }

    const viewIds = views.map(v => v.id);
    
    // Delete page views older than 30 days that don't have a corresponding deck_view
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: orphanedViews } = await supabaseAdmin
      .from('page_views')
      .select('id, view_id')
      .lt('viewed_at', cutoff.toISOString());

    if (!orphanedViews || orphanedViews.length === 0) {
      return 0;
    }

    // Filter to only those not in viewIds
    const toDelete = orphanedViews
      .filter(pv => !viewIds.includes(pv.view_id))
      .map(pv => pv.id);

    if (toDelete.length === 0) {
      return 0;
    }

    // Delete in batches (Supabase has limits)
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { count } = await supabaseAdmin
        .from('page_views')
        .delete()
        .in('id', batch);
      deleted += count || 0;
    }

    return deleted;
  } catch (error) {
    console.error('Error cleaning up orphaned page views:', error);
    return 0;
  }
}

/**
 * Clean up expired OTP data from Redis
 * (OTPs already have TTL, but this cleans up any stuck keys)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  try {
    const redis = await getRedisClient();
    
    // Find all OTP keys
    const otpKeys = await redis.keys('otp:*');
    const rateLimitKeys = await redis.keys('otp:ratelimit:*');
    const attemptKeys = await redis.keys('otp_attempts:*');
    const cooldownKeys = await redis.keys('otp_cooldown:*');
    
    const allKeys = [...otpKeys, ...rateLimitKeys, ...attemptKeys, ...cooldownKeys];
    
    if (allKeys.length === 0) {
      return 0;
    }

    // Check TTL for each key and delete if expired or very old
    let deleted = 0;
    for (const key of allKeys) {
      const ttl = await redis.ttl(key);
      // Delete if expired (TTL = -2) or if TTL is -1 (no expiration set, which shouldn't happen)
      if (ttl === -2 || ttl === -1) {
        await redis.del(key);
        deleted++;
      }
    }

    return deleted;
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
    return 0;
  }
}

/**
 * Clean up old access tokens from localStorage (client-side helper)
 * This should be called from the client
 */
export function cleanupLocalStorageTokens(): number {
  if (typeof window === 'undefined') return 0;

  let cleaned = 0;
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Clean up access tokens
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('access_token_')) {
      // Access tokens don't have timestamps, but we can clean up old analytics sessions
      // The JWT itself has expiration, so we'll rely on that
      continue;
    }
    
    // Clean up old analytics sessions
    if (key?.startsWith('analytics_session_')) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const session = JSON.parse(data);
          const sessionAge = now - (session.startTime || 0);
          if (sessionAge > maxAge) {
            localStorage.removeItem(key);
            cleaned++;
          }
        }
      } catch {
        // Invalid data, remove it
        localStorage.removeItem(key);
        cleaned++;
      }
    }
  }

  return cleaned;
}

/**
 * Comprehensive cleanup - runs all cleanup functions
 */
export async function runFullCleanup(): Promise<{
  analytics: { deletedCompleted: number; deletedIncomplete: number };
  orphanedPageViews: number;
  expiredOTPs: number;
}> {
  const [analytics, orphanedPageViews, expiredOTPs] = await Promise.all([
    cleanupAnalyticsSessions(),
    cleanupOrphanedPageViews(),
    cleanupExpiredOTPs(),
  ]);

  return {
    analytics,
    orphanedPageViews,
    expiredOTPs,
  };
}


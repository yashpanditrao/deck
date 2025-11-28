import { NextRequest, NextResponse } from 'next/server';
import { runFullCleanup } from '@/lib/session-cleanup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Cleanup API endpoint
 * POST /api/cleanup - Run full cleanup
 * GET /api/cleanup - Run full cleanup (for cron jobs)
 * 
 * This endpoint should be called periodically (e.g., via cron) to clean up old data
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization here
    // For now, we'll allow it but you might want to add API key auth
    
    const result = await runFullCleanup();

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      results: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Same as POST, for cron job compatibility
  return POST(request);
}


import { NextRequest, NextResponse } from 'next/server';
import { 
  invalidatePDFCache, 
  getPDFCacheInfo, 
  clearAllPDFCaches 
} from '@/lib/pdf-cache';

/**
 * Cache management API endpoint
 * POST /api/cache/manage
 * 
 * Actions:
 * - invalidate: Remove a specific PDF from cache
 * - info: Get cache statistics for a specific PDF
 * - clear-all: Clear all PDF caches (use with caution)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filePath } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'invalidate':
        if (!filePath) {
          return NextResponse.json(
            { error: 'filePath is required for invalidate action' },
            { status: 400 }
          );
        }
        await invalidatePDFCache(filePath);
        return NextResponse.json({
          success: true,
          message: `Cache invalidated for: ${filePath}`
        });

      case 'info':
        if (!filePath) {
          return NextResponse.json(
            { error: 'filePath is required for info action' },
            { status: 400 }
          );
        }
        const info = await getPDFCacheInfo(filePath);
        return NextResponse.json({
          success: true,
          filePath,
          cache: info
        });

      case 'clear-all':
        const cleared = await clearAllPDFCaches();
        return NextResponse.json({
          success: true,
          message: `Cleared ${cleared} PDF caches`
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get cache statistics
 * GET /api/cache/manage?filePath=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath query parameter is required' },
        { status: 400 }
      );
    }

    const info = await getPDFCacheInfo(filePath);
    return NextResponse.json({
      success: true,
      filePath,
      cache: info
    });
  } catch (error) {
    console.error('Cache info error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


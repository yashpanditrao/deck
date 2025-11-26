import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { DeckShareLink, DeckView, PageView } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get share link info
    const { data: shareLinkData, error: shareLinkError } = await supabaseAdmin
      .from('deck_share_links')
      .select('*')
      .eq('token', token)
      .single();

    if (shareLinkError || !shareLinkData) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      );
    }

    const shareLink = shareLinkData as DeckShareLink;

    // Get all views for this share link
    const { data: views, error: viewsError } = await supabaseAdmin
      .from('deck_views')
      .select('*')
      .eq('share_link_id', shareLink.id)
      .order('started_at', { ascending: false });

    if (viewsError) {
      console.error('Error fetching views:', viewsError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    const viewList: DeckView[] = (views ?? []) as DeckView[];

    // Get page views for all views
    const viewIds = viewList.map((v) => v.id);
    let pageViews: PageView[] = [];
    
    if (viewIds.length > 0) {
      const { data: pv, error: pageViewsError } = await supabaseAdmin
        .from('page_views')
        .select('*')
        .in('view_id', viewIds)
        .order('viewed_at', { ascending: true });

      if (!pageViewsError && pv) {
        pageViews = pv;
      }
    }

    // Calculate analytics
    const totalViews = viewList.length;
    const uniqueViewers = new Set(
      viewList.map(v => v.viewer_email || v.viewer_id).filter(Boolean)
    ).size;
    
    const totalDuration = viewList.reduce(
      (sum, v) => sum + (v.total_duration || 0),
      0
    );
    const avgDuration = totalViews > 0 ? Math.round(totalDuration / totalViews) : 0;

    // Calculate completion rate based on actual page views
    // Get the maximum total_pages from all views (should be consistent across sessions)
    const totalPages = viewList.length > 0 
      ? Math.max(...viewList.map(v => v.total_pages || 0))
      : 0;

    // Calculate completion rate
    // A view is considered completed if they viewed at least 80% of the pages
    const completedViews = viewList.filter(v => {
      const pagesViewedCount = v.pages_viewed?.length || 0;
      const viewTotalPages = v.total_pages || totalPages;
      
      // If we don't know total pages yet, can't determine completion
      if (viewTotalPages === 0) {
        return false;
      }
      
      // Calculate if they viewed at least 80% of pages
      const viewedPercentage = pagesViewedCount / viewTotalPages;
      return viewedPercentage >= 0.8;
    }).length;
    const completionRate = totalViews > 0 ? Math.round((completedViews / totalViews) * 100) : 0;

    // Page engagement - which pages were viewed most
    const pageEngagement: { [key: number]: number } = {};
    pageViews.forEach(pv => {
      pageEngagement[pv.page_number] = (pageEngagement[pv.page_number] || 0) + 1;
    });

    // Recent viewers
    const recentViewers = viewList.slice(0, 10).map(v => ({
      id: v.id,
      viewer: v.viewer_email || 'Anonymous',
      startedAt: v.started_at,
      duration: v.total_duration,
      pagesViewed: v.pages_viewed?.length || 0,
      completed: v.completed,
      location: v.city && v.country ? `${v.city}, ${v.country}` : v.country || 'Unknown',
    })) || [];

    // Views over time (grouped by day)
    const viewsByDay: { [key: string]: number } = {};
    viewList.forEach(v => {
      const date = new Date(v.started_at).toISOString().split('T')[0];
      viewsByDay[date] = (viewsByDay[date] || 0) + 1;
    });

    const allViews = viewList.map(v => ({
      id: v.id,
      viewer: v.viewer_email || 'Anonymous',
      startedAt: v.started_at,
      lastActiveAt: v.last_active_at,
      duration: v.total_duration,
      pagesViewed: v.pages_viewed || [],
      completed: v.completed,
      userAgent: v.user_agent,
      location: v.city && v.country ? `${v.city}, ${v.country}` : v.country || 'Unknown',
    }));

    const analytics = {
      summary: {
        totalViews,
        uniqueViewers,
        avgDuration,
        completionRate,
      },
      pageEngagement: Object.entries(pageEngagement).map(([page, views]) => ({
        page: parseInt(page),
        views,
      })).sort((a, b) => b.views - a.views),
      recentViewers,
      viewsByDay: Object.entries(viewsByDay).map(([date, count]) => ({
        date,
        count,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      allViews,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import type { DeckShareLink, DeckView, PageView } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get share link info (must belong to authenticated user)
    const { data: shareLinkData, error: shareLinkError } = await supabaseAdmin
      .from("deck_share_links")
      .select("*")
      .eq("token", token)
      .single();

    if (shareLinkError || !shareLinkData) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    const shareLink = shareLinkData as DeckShareLink;

    if (shareLink.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all views for this share link
    const { data: views, error: viewsError } = await supabaseAdmin
      .from("deck_views")
      .select("*")
      .eq("share_link_id", shareLink.id)
      .order("started_at", { ascending: false });

    if (viewsError) {
      console.error("Error fetching views:", viewsError);
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 },
      );
    }

    const viewList: DeckView[] = (views ?? []) as DeckView[];

    const getLocationLabel = (view: DeckView) =>
      view.city && view.country
        ? `${view.city}, ${view.country}`
        : view.country || "Unknown";

    // Get page views for all views
    const viewIds = viewList.map((v) => v.id);
    let pageViews: PageView[] = [];

    if (viewIds.length > 0) {
      const { data: pv, error: pageViewsError } = await supabaseAdmin
        .from("page_views")
        .select("*")
        .in("view_id", viewIds)
        .order("viewed_at", { ascending: true });

      if (!pageViewsError && pv) {
        pageViews = pv;
      }
    }

    // Calculate analytics
    const totalViews = viewList.length;
    const uniqueViewers = new Set(
      viewList.map((v) => v.viewer_email || v.viewer_id).filter(Boolean),
    ).size;

    const totalDuration = viewList.reduce(
      (sum, v) => sum + (v.total_duration || 0),
      0,
    );
    const avgDuration =
      totalViews > 0 ? Math.round(totalDuration / totalViews) : 0;

    // Calculate completion rate based on actual page views
    // Get the maximum total_pages from all views (should be consistent across sessions)
    const totalPages =
      viewList.length > 0
        ? Math.max(...viewList.map((v) => v.total_pages || 0))
        : 0;

    // Calculate completion rate
    // A view is considered completed if they viewed at least 80% of the pages
    const completedViews = viewList.filter((v) => {
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
    const completionRate =
      totalViews > 0 ? Math.round((completedViews / totalViews) * 100) : 0;

    // Page engagement - which pages were viewed most
    const pageEngagement: { [key: number]: number } = {};
    pageViews.forEach((pv) => {
      pageEngagement[pv.page_number] =
        (pageEngagement[pv.page_number] || 0) + 1;
    });

    // Location distribution
    const locationCounts = new Map<string, number>();
    viewList.forEach((view) => {
      const label = getLocationLabel(view);
      locationCounts.set(label, (locationCounts.get(label) || 0) + 1);
    });

    const locationStats = Array.from(locationCounts.entries())
      .map(([location, count]) => ({
        location,
        count,
        percentage: totalViews > 0 ? Math.round((count / totalViews) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Viewer-level aggregation
    const viewerStatsMap = new Map<
      string,
      {
        viewerKey: string;
        viewer: string;
        sessions: number;
        totalDuration: number;
        completedSessions: number;
        lastViewedAt: string;
        location: string;
      }
    >();

    viewList.forEach((view) => {
      const key = view.viewer_email || view.viewer_id || view.id;
      const displayName = view.viewer_email || "Anonymous";
      const existing = viewerStatsMap.get(key);

      if (!existing) {
        viewerStatsMap.set(key, {
          viewerKey: key,
          viewer: displayName,
          sessions: 0,
          totalDuration: 0,
          completedSessions: 0,
          lastViewedAt: view.last_active_at,
          location: getLocationLabel(view),
        });
      }

      const stats = viewerStatsMap.get(key)!;
      stats.sessions += 1;
      stats.totalDuration += view.total_duration || 0;
      stats.completedSessions += view.completed ? 1 : 0;
      if (
        !stats.lastViewedAt ||
        new Date(view.last_active_at).getTime() >
          new Date(stats.lastViewedAt).getTime()
      ) {
        stats.lastViewedAt = view.last_active_at;
        stats.location = getLocationLabel(view);
      }
    });

    const viewerDetails = Array.from(viewerStatsMap.values())
      .map((stats) => ({
        viewerKey: stats.viewerKey,
        viewer: stats.viewer,
        sessions: stats.sessions,
        totalDuration: stats.totalDuration,
        avgSessionDuration:
          stats.sessions > 0
            ? Math.round(stats.totalDuration / stats.sessions)
            : 0,
        completionRate:
          stats.sessions > 0
            ? Math.round((stats.completedSessions / stats.sessions) * 100)
            : 0,
        lastViewedAt: stats.lastViewedAt,
        location: stats.location,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastViewedAt).getTime() -
          new Date(a.lastViewedAt).getTime(),
      );

    // Page timing aggregation
    const pageTimingMap = new Map<
      number,
      { page: number; totalDuration: number; views: number }
    >();
    pageViews.forEach((pv) => {
      const existing = pageTimingMap.get(pv.page_number) || {
        page: pv.page_number,
        totalDuration: 0,
        views: 0,
      };
      existing.totalDuration += pv.duration || 0;
      existing.views += 1;
      pageTimingMap.set(pv.page_number, existing);
    });

    const pageTiming = Array.from(pageTimingMap.values())
      .map((entry) => ({
        page: entry.page,
        totalDuration: entry.totalDuration,
        avgDuration:
          entry.views > 0 ? Math.round(entry.totalDuration / entry.views) : 0,
        views: entry.views,
      }))
      .sort((a, b) => a.page - b.page);

    // Recent viewers
    const recentViewers =
      viewList.slice(0, 10).map((v) => ({
        id: v.id,
        viewer: v.viewer_email || "Anonymous",
        startedAt: v.started_at,
        duration: v.total_duration,
        pagesViewed: v.pages_viewed?.length || 0,
        completed: v.completed,
        location: getLocationLabel(v),
      })) || [];

    // Views over time (grouped by day)
    const viewsByDay: { [key: string]: number } = {};
    viewList.forEach((v) => {
      const date = new Date(v.started_at).toISOString().split("T")[0];
      viewsByDay[date] = (viewsByDay[date] || 0) + 1;
    });

    const allViews = viewList.map((v) => ({
      id: v.id,
      viewer: v.viewer_email || "Anonymous",
      startedAt: v.started_at,
      lastActiveAt: v.last_active_at,
      duration: v.total_duration,
      pagesViewed: v.pages_viewed || [],
      completed: v.completed,
      userAgent: v.user_agent,
      location: getLocationLabel(v),
    }));

    const analytics = {
      summary: {
        totalViews,
        uniqueViewers,
        avgDuration,
        completionRate,
      },
      pageEngagement: Object.entries(pageEngagement)
        .map(([page, views]) => ({
          page: parseInt(page),
          views,
        }))
        .sort((a, b) => b.views - a.views),
      recentViewers,
      viewsByDay: Object.entries(viewsByDay)
        .map(([date, count]) => ({
          date,
          count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      allViews,
      viewerDetails,
      pageTiming,
      locationStats,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

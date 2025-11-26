'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Clock, Users, TrendingUp, ArrowLeft, Mail, MapPin } from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalViews: number;
    uniqueViewers: number;
    avgDuration: number;
    completionRate: number;
  };
  pageEngagement: Array<{
    page: number;
    views: number;
  }>;
  recentViewers: Array<{
    id: string;
    viewer: string;
    startedAt: string;
    duration: number;
    pagesViewed: number;
    completed: boolean;
    location: string;
  }>;
  viewsByDay: Array<{
    date: string;
    count: number;
  }>;
  allViews: Array<{
    id: string;
    viewer: string;
    startedAt: string;
    lastActiveAt: string;
    duration: number;
    pagesViewed: number[];
    completed: boolean;
    userAgent: string | null;
    location: string;
  }>;
  viewerDetails: Array<{
    viewerKey: string;
    viewer: string;
    sessions: number;
    totalDuration: number;
    avgSessionDuration: number;
    completionRate: number;
    lastViewedAt: string;
    location: string;
  }>;
  pageTiming: Array<{
    page: number;
    totalDuration: number;
    avgDuration: number;
    views: number;
  }>;
  locationStats: Array<{
    location: string;
    count: number;
    percentage: number;
  }>;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SparklineChart = ({
  data,
  height = 120,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
}) => {
  if (!data.length) {
    return <p className="text-sm text-gray-500">No data yet</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.value)) || 1;
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1 || 1)) * 100;
    const y = 100 - (item.value / maxValue) * 100;
    return `${x},${y}`;
  });

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#sparklineGradient)"
          stroke="none"
          points={`0,100 ${points.join(' ')} 100,100`}
        />
        <polyline
          fill="none"
          stroke="url(#sparklineGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(' ')}
        />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const GradientBarList = ({
  data,
  labelFormatter,
  valueFormatter,
}: {
  data: Array<{ label: string; value: number; secondary?: string }>;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}) => {
  if (!data.length) {
    return <p className="text-sm text-gray-500">No data yet</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.value)) || 1;

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">
              {labelFormatter ? labelFormatter(item.label) : item.label}
            </span>
            <span className="text-gray-600">
              {valueFormatter ? valueFormatter(item.value) : item.value}
            </span>
          </div>
          {item.secondary && (
            <p className="text-xs text-gray-500 mb-1">{item.secondary}</p>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-400"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const PieChart = ({
  data,
  size = 140,
  strokeWidth = 14,
}: {
  data: Array<{ label: string; value: number }>;
  size?: number;
  strokeWidth?: number;
}) => {
  const filteredData = data.filter((item) => item.value > 0);

  if (!filteredData.length) {
    return <p className="text-sm text-gray-500">No location data yet</p>;
  }

  const total = filteredData.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const colors = ['#6366F1', '#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444'];
  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {filteredData.map((slice, index) => {
          const value = slice.value / total;
          const dashArray = `${value * circumference} ${circumference}`;
          const dashOffset = circumference * (0.25 - cumulative);
          cumulative += value;

          return (
            <circle
              key={`slice-${slice.label}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={colors[index % colors.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="w-full space-y-2">
        {filteredData.map((slice, index) => (
          <div key={slice.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              ></span>
              <span>{slice.label}</span>
            </div>
            <span className="text-gray-600">
              {slice.value} ({Math.round((slice.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsContent = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllPages, setShowAllPages] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!token) {
        setError('No token provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/analytics/deck?token=${token}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No token provided. Please use a valid analytics link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{error || 'Failed to load analytics'}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topLocations = analytics.locationStats?.slice(0, 5) ?? [];
  const totalLocationCount = analytics.locationStats?.reduce((sum, loc) => sum + loc.count, 0) ?? 0;
  const topLocationCount = topLocations.reduce((sum, loc) => sum + loc.count, 0);
  const locationChartData = [
    ...topLocations.map((loc) => ({ label: loc.location, value: loc.count })),
    ...(totalLocationCount - topLocationCount > 0
      ? [{ label: 'Other', value: totalLocationCount - topLocationCount }]
      : []),
  ];
  const PAGE_TIMING_PREVIEW_COUNT = 5;
  const displayedPageTiming = showAllPages
    ? analytics.pageTiming
    : analytics.pageTiming.slice(0, PAGE_TIMING_PREVIEW_COUNT);
  const hasMorePageTiming = analytics.pageTiming.length > PAGE_TIMING_PREVIEW_COUNT;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Deck Analytics</h1>
                <p className="text-sm text-gray-500 mt-1">
                  View detailed performance metrics for your pitch deck
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.totalViews}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All time views
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Viewers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.uniqueViewers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Distinct viewers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(analytics.summary.avgDuration)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per view session
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.completionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Viewed full deck
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Viewer Activity</CardTitle>
              <p className="text-sm text-gray-500">Sparkline of daily sessions</p>
            </CardHeader>
            <CardContent>
              <SparklineChart
                data={analytics.viewsByDay.map((day) => ({
                  label: new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  }),
                  value: day.count,
                }))}
              />
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-1">Last 14 days</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {analytics.viewsByDay.slice(-14).reduce((sum, day) => sum + day.count, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-1">Peak day</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {analytics.viewsByDay.length ? Math.max(...analytics.viewsByDay.map((day) => day.count)) : 0} views
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hot Pages</CardTitle>
              <p className="text-sm text-gray-500">Slides earning the most attention</p>
            </CardHeader>
            <CardContent>
              <GradientBarList
                data={analytics.pageEngagement.slice(0, 6).map((page) => ({
                  label: `Page ${page.page}`,
                  value: page.views,
                  secondary: `${page.views} views`,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* Viewer Insights, Page Timing & Geography */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Viewer Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Viewer</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Sessions</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Avg Session</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Total Watch Time</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Completion Rate</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Last Active</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.viewerDetails.length > 0 ? (
                      analytics.viewerDetails.map((viewer) => (
                        <tr key={viewer.viewerKey} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {viewer.viewer !== 'Anonymous' ? (
                                <Mail className="w-4 h-4 text-gray-400" />
                              ) : null}
                              <span className="text-sm font-medium">{viewer.viewer}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{viewer.sessions}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDuration(viewer.avgSessionDuration)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDuration(viewer.totalDuration)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{viewer.completionRate}%</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDate(viewer.lastViewedAt)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{viewer.location}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                          No viewer sessions yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Page Timing</CardTitle>
              <p className="text-sm text-gray-500">Average dwell time per slide</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayedPageTiming.length > 0 ? (
                  displayedPageTiming.map((page) => (
                    <div key={page.page} className="p-3 rounded-lg border bg-gradient-to-br from-white via-gray-50 to-blue-50">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-800">Page {page.page}</span>
                        <span className="text-gray-500">{page.views} views</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Avg time on page</p>
                          <p className="text-xl font-semibold text-gray-900">{formatDuration(page.avgDuration)}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total watch time</p>
                          <p className="text-xl font-semibold text-gray-900">{formatDuration(page.totalDuration)}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
                            style={{
                              width: `${Math.min(
                                (page.avgDuration /
                                  (Math.max(...analytics.pageTiming.map((p) => p.avgDuration)) || 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">No page timing data yet</p>
                )}
              </div>
              {hasMorePageTiming && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllPages((prev) => !prev)}
                    className="text-sm"
                  >
                    {showAllPages ? 'Show Less' : 'View More Pages'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Viewer Geography</CardTitle>
              <p className="text-sm text-gray-500">Where sessions originate</p>
            </CardHeader>
            <CardContent>
              {locationChartData.length > 0 ? (
                <PieChart data={locationChartData} />
              ) : (
                <p className="text-sm text-gray-500 text-center py-6">No location data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Viewers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Viewers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                      Viewer
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                      Started At
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                      Duration
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                      Pages Viewed
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                      Location
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.allViews.length > 0 ? (
                    analytics.allViews.map((view) => (
                      <tr key={view.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {view.viewer !== 'Anonymous' ? (
                              <Mail className="w-4 h-4 text-gray-400" />
                            ) : null}
                            <span className="text-sm font-medium">
                              {view.viewer}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(view.startedAt)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDuration(view.duration)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {view.pagesViewed.length} pages
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{view.location}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              view.completed
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {view.completed ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                        No viewers yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="text-gray-600">Loading...</span>
          </div>
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}

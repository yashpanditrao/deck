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

const AnalyticsContent = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Page Engagement */}
          <Card>
            <CardHeader>
              <CardTitle>Page Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.pageEngagement.length > 0 ? (
                  analytics.pageEngagement.slice(0, 10).map((page) => {
                    const maxViews = Math.max(...analytics.pageEngagement.map(p => p.views));
                    const percentage = (page.views / maxViews) * 100;
                    
                    return (
                      <div key={page.page} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Page {page.page}</span>
                          <span className="text-gray-600">{page.views} views</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No page views yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Views Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Views Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.viewsByDay.length > 0 ? (
                  analytics.viewsByDay.slice(-14).map((day) => {
                    const maxViews = Math.max(...analytics.viewsByDay.map(d => d.count));
                    const percentage = (day.count / maxViews) * 100;
                    
                    return (
                      <div key={day.date} className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-600 w-24">
                          {new Date(day.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{day.count}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No views yet
                  </p>
                )}
              </div>
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


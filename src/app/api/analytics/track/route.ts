import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAccessToken } from '@/lib/jwt';

interface TrackEventPayload {
  token: string;
  accessToken?: string;
  eventType: 'view_start' | 'page_view' | 'view_end';
  viewId?: string; // For continuing existing sessions
  pageNumber?: number;
  duration?: number;
  totalPages?: number; // Total pages in the deck
  pageStartedAt?: string;
  pageEndedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrackEventPayload = await request.json();
    const {
      token,
      accessToken,
      eventType,
      viewId,
      pageNumber,
      duration,
      totalPages,
      pageStartedAt,
      pageEndedAt,
    } = payload;

    if (!token || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get share link and deck info
    const { data: shareLink, error: shareLinkError } = await supabaseAdmin
      .from('deck_share_links')
      .select('id, deck_id, recipient_email, require_verification')
      .eq('token', token)
      .single();

    if (shareLinkError || !shareLink) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      );
    }

    // Get viewer email if authenticated
    let viewerEmail: string | null = null;
    if (accessToken) {
      try {
        const decoded = await verifyAccessToken(accessToken);
        if (decoded && decoded.email) {
          viewerEmail = decoded.email;
        }
      } catch (error) {
        console.error('Failed to verify access token:', error);
        // Invalid JWT, continue as anonymous
      }
    }

    // Get user agent and IP for analytics
    const userAgent = request.headers.get('user-agent') || null;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 
                      request.headers.get('x-real-ip') || null;
    
    // Get geolocation from IP address
    async function getGeolocation(ip: string | null): Promise<{ country: string | null; city: string | null }> {
      // First try Vercel's geo headers (free on Vercel)
      const vercelCountry = request.headers.get('x-vercel-ip-country');
      const vercelCity = request.headers.get('x-vercel-ip-city');
      
      if (vercelCountry) {
        return {
          country: vercelCountry,
          city: vercelCity,
        };
      }
      
      // Fallback: Use ipapi.co (free, 30k requests/month, no API key needed)
      if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        return { country: null, city: null };
      }
      
      try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { 'User-Agent': 'deck-analytics/1.0' },
          signal: AbortSignal.timeout(3000), // 3 second timeout
        });
        
        if (!response.ok) {
          return { country: null, city: null };
        }
        
        const data = await response.json();
        
        return {
          country: data.country_name || null,
          city: data.city || null,
        };
      } catch (error) {
        console.error('Geolocation lookup failed:', error);
        return { country: null, city: null };
      }
    }
    
    const { country, city } = await getGeolocation(ipAddress);

    // Handle different event types
    switch (eventType) {
      case 'view_start': {
        // Check if there's an existing session (viewId)
        if (viewId) {
          // Resume existing session by viewId
          const { data: existingView, error: viewError } = await supabaseAdmin
            .from('deck_views')
            .select('*')
            .eq('id', viewId)
            .single();

          if (!viewError && existingView) {
            // Update last_active_at
            const { error: updateError } = await supabaseAdmin
              .from('deck_views')
              .update({
                last_active_at: new Date().toISOString(),
                ended_at: null,
              })
              .eq('id', viewId);

            if (!updateError) {
              return NextResponse.json({
                success: true,
                viewId: existingView.id,
                resumed: true,
              });
            }
          }
        }

        // For authenticated users, check if they already have a recent session
        // to prevent duplicate viewer entries
        if (viewerEmail) {
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          
          const { data: recentSession, error: recentError } = await supabaseAdmin
            .from('deck_views')
            .select('*')
            .eq('share_link_id', shareLink.id)
            .eq('viewer_email', viewerEmail)
            .gte('started_at', twentyFourHoursAgo)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (!recentError && recentSession) {
            // Found a recent session for this email, resume it
            const { error: updateError } = await supabaseAdmin
              .from('deck_views')
              .update({
                last_active_at: new Date().toISOString(),
                ended_at: null,
              })
              .eq('id', recentSession.id);

            if (!updateError) {
              return NextResponse.json({
                success: true,
                viewId: recentSession.id,
                resumed: true,
              });
            }
          }
        }

        // Create new view session
        const { data: newView, error: insertError } = await supabaseAdmin
          .from('deck_views')
          .insert({
            deck_id: shareLink.deck_id,
            share_link_id: shareLink.id,
            viewer_email: viewerEmail,
            viewer_id: viewId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            started_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            ended_at: null,
            total_duration: 0,
            pages_viewed: [],
            completed: false,
            total_pages: 0, // Will be updated on first page view
            user_agent: userAgent,
            ip_address: ipAddress,
            country: country,
            city: city,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating view:', insertError);
          return NextResponse.json(
            { error: 'Failed to track view' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          viewId: newView.id,
          resumed: false,
        });
      }

      case 'page_view': {
        if (!viewId || pageNumber === undefined) {
          return NextResponse.json(
            { error: 'viewId and pageNumber required for page_view' },
            { status: 400 }
          );
        }

        // Get current view
        const { data: currentView, error: viewError } = await supabaseAdmin
          .from('deck_views')
          .select('pages_viewed, total_duration, completed, total_pages')
          .eq('id', viewId)
          .single();

        if (viewError || !currentView) {
          return NextResponse.json(
            { error: 'View not found' },
            { status: 404 }
          );
        }

        // Update pages viewed array
        const pagesViewed = currentView.pages_viewed || [];
        if (!pagesViewed.includes(pageNumber)) {
          pagesViewed.push(pageNumber);
        }

        // Update total pages if provided
        const deckTotalPages = totalPages || currentView.total_pages || 0;

        const normalizedDuration = Math.max(duration || 0, 0);
        const now = new Date();
        const nowIso = now.toISOString();
        const pageStartedIso = pageStartedAt || new Date(now.getTime() - normalizedDuration * 1000).toISOString();
        const pageEndedIso = pageEndedAt || nowIso;

        // Check if this view should be marked as completed
        // Mark as completed if they've viewed at least 80% of pages OR reached the last page
        let isCompleted = currentView.completed;
        if (!isCompleted && deckTotalPages > 0) {
          const viewedPercentage = pagesViewed.length / deckTotalPages;
          if (viewedPercentage >= 0.8 || pageNumber === deckTotalPages) {
            isCompleted = true;
          }
        }

        // Update view with new page and duration
        const { error: updateError } = await supabaseAdmin
          .from('deck_views')
          .update({
            pages_viewed: pagesViewed,
            total_duration: (currentView.total_duration || 0) + normalizedDuration,
            last_active_at: pageEndedIso,
            completed: isCompleted,
            total_pages: deckTotalPages, // Store total pages
          })
          .eq('id', viewId);

        if (updateError) {
          console.error('Error updating view:', updateError);
          return NextResponse.json(
            { error: 'Failed to update view' },
            { status: 500 }
          );
        }

        // Record individual page view
        const { error: pageViewError } = await supabaseAdmin
          .from('page_views')
          .insert({
            view_id: viewId,
            page_number: pageNumber,
            duration: normalizedDuration,
            viewed_at: pageStartedIso,
            exited_at: pageEndedIso,
          });

        if (pageViewError) {
          console.error('Error recording page view:', pageViewError);
          // Don't fail the request, just log the error
        }

        return NextResponse.json({ success: true });
      }

      case 'view_end': {
        if (!viewId) {
          return NextResponse.json(
            { error: 'viewId required for view_end' },
            { status: 400 }
          );
        }

        const sessionEndedAt = new Date().toISOString();
        const totalDuration = Math.max(duration || 0, 0);

        // Mark view as completed and update final duration
        const { error: updateError } = await supabaseAdmin
          .from('deck_views')
          .update({
            completed: true,
            total_duration: totalDuration,
            last_active_at: sessionEndedAt,
            ended_at: sessionEndedAt,
          })
          .eq('id', viewId);

        if (updateError) {
          console.error('Error completing view:', updateError);
          return NextResponse.json(
            { error: 'Failed to complete view' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid event type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    // Enhanced input validation
    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      )
    }

    // Query the deck share link using anon client (RLS allows SELECT)
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select('*')
      .eq('token', token)
      .single<DeckShareLink>()

    if (error || !shareLink) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 410 }
      )
    }

    // Additional security: Check if token is too old (30 days)
    if (shareLink.created_at) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      if (new Date(shareLink.created_at) < thirtyDaysAgo) {
        return NextResponse.json(
          { error: 'Share link is too old' },
          { status: 410 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        deck_url: shareLink.deck_url,
        recipient_email: shareLink.recipient_email,
        is_verified: shareLink.is_verified,
        expires_at: shareLink.expires_at
      }
    })

  } catch (err) {
    console.error('Token validation error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
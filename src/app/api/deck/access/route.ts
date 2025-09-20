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

    // Get the share link with anon client (RLS allows SELECT)
    // Only select necessary fields and ensure is_verified is true
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select('deck_url, deck_id, expires_at, is_verified, created_at')
      .eq('token', token)
      .eq('is_verified', true) // Only get verified shares
      .single<DeckShareLink>()

    if (error || !shareLink) {
      return NextResponse.json(
        { error: 'Invalid token or verification required' },
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
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    if (new Date(shareLink.created_at) < thirtyDaysAgo) {
      return NextResponse.json(
        { error: 'Share link is too old' },
        { status: 410 }
      )
    }

    // Note: No need to check is_verified here since we already filtered for it in the query

    return NextResponse.json({
      success: true,
      data: {
        deck_url: shareLink.deck_url,
      }
    })

  } catch (err) {
    console.error('Deck access error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

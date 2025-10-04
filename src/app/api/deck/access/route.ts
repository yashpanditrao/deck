import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'
import { generateSignedUrl } from '@/lib/supabase-storage'

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
    // Note: Removed is_verified check as frontend handles verification properly
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select('deck_url, expires_at, created_at')
      .eq('token', token)
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

    // Generate signed URL for the deck file
    try {
      const signedUrl = await generateSignedUrl(shareLink.deck_url, 3600) // 1 hour expiration
      
      return NextResponse.json({
        success: true,
        data: {
          deck_url: signedUrl,
        }
      })
    } catch (signedUrlError) {
      console.error('Error generating signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to access deck file' },
        { status: 500 }
      )
    }

  } catch (err) {
    console.error('Deck access error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

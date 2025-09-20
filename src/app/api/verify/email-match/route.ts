import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json()

    // Enhanced input validation
    if (!token || !email || typeof token !== 'string' || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Token and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate token format
    if (token.length < 10) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      )
    }

    // First validate token with anon client (RLS allows SELECT)
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select('*')
      .eq('token', token)
      .single<DeckShareLink>()

    if (error || !shareLink) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // Verify the email matches the intended recipient
    if (shareLink.recipient_email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match the intended recipient' },
        { status: 403 }
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

    // Mark as verified (admin needed for UPDATE)
    const { error: updateError } = await supabaseAdmin
      .from('deck_share_links')
      .update({
        is_verified: true,
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', shareLink.id)
      .eq('recipient_email', email.toLowerCase())

    if (updateError) {
      console.error('Error updating verification status:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully'
    })

  } catch (err) {
    console.error('Email verification error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
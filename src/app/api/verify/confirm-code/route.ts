import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const { token, code } = await request.json()

    // Enhanced input validation
    if (!token || !code || typeof token !== 'string' || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Token and code are required' },
        { status: 400 }
      )
    }

    // Validate code format (must be 6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid verification code format' },
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

    // Check if verification code exists and is not expired
    if (!shareLink.verification_code || !shareLink.verification_code_expires) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new code.' },
        { status: 400 }
      )
    }

    if (new Date(shareLink.verification_code_expires) < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 410 }
      )
    }

    // Verify the code
    if (shareLink.verification_code !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 403 }
      )
    }

    // Mark as verified and clear verification code (admin needed for UPDATE)
    const { error: updateError } = await supabaseAdmin
      .from('deck_share_links')
      .update({
        is_verified: true,
        verification_code: null,
        verification_code_expires: null,
        updated_at: new Date().toISOString()
      } as never) // Using 'as never' to bypass TypeScript error
      .eq('id', shareLink.id)
      .eq('token', token)

    if (updateError) {
      console.error('Error updating verification status:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify code' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully'
    })

  } catch (err) {
    console.error('Verify code error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
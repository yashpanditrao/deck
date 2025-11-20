import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'
import { generateAccessToken } from '@/lib/jwt'
import { OTPStorage } from '@/lib/otp-storage'

export async function POST(request: NextRequest) {
  try {
    const { token, code, email } = await request.json()

    // Enhanced input validation
    if (!token || !code || !email || typeof token !== 'string' || typeof code !== 'string' || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Token, code, and email are required' },
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
        { error: 'Invalid verification code format' }, // Generic error
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid verification code format' }, // Generic error
        { status: 400 }
      )
    }

    // Get share link
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select('*')
      .eq('token', token)
      .single<DeckShareLink>()

    if (error || !shareLink) {
      return NextResponse.json(
        { error: 'Invalid verification code format' }, // Generic error
        { status: 404 }
      )
    }

    // Verify OTP using secure method (constant-time comparison + rate limiting)
    const verifyResult = await OTPStorage.verify(token, code, email);

    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error || 'Invalid verification code' },
        { status: 403 }
      )
    }

    // OTP verified successfully - generate JWT access token
    const accessLevel = shareLink.access_level || 'restricted'
    const accessToken = await generateAccessToken({
      token,
      email: email.toLowerCase(),
      accessLevel
    })

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      accessToken
    })

  } catch (err) {
    console.error('Verify code error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
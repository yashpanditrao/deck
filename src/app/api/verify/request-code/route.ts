import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'
import { Resend } from 'resend'
import { OTPStorage } from '@/lib/otp-storage'
import { randomInt } from 'crypto'

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

    // Check access permissions
    const accessLevel = shareLink.access_level || 'restricted';

    if (accessLevel === 'whitelisted') {
      const allowedEmails = (shareLink.allowed_emails || []).map((e: string) => e.toLowerCase());
      const allowedDomains = (shareLink.allowed_domains || []).map((d: string) => d.toLowerCase());
      const userEmail = email.toLowerCase();
      const userDomain = userEmail.split('@')[1];

      const isEmailAllowed = allowedEmails.includes(userEmail);
      const isDomainAllowed = allowedDomains.includes(userDomain);

      if (!isEmailAllowed && !isDomainAllowed) {
        // Generic error message to prevent email enumeration attack
        return NextResponse.json(
          { error: 'Unable to send verification code. Please try again later.' },
          { status: 400 }
        )
      }
    }
    // For 'restricted' access level, we allow any email but require verification

    // Check rate limiting for this email (prevent spam)
    const rateLimit = await OTPStorage.checkRateLimit(email);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Generate a cryptographically secure 6-digit verification code
    // Using crypto.randomInt instead of Math.random for security
    const verificationCode = randomInt(100000, 1000000).toString()

    // Store OTP using shared storage (with rate limiting)
    await OTPStorage.set(token, verificationCode, email);

    // Send email via Resend
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: OTP is', verificationCode);
    }

    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error('RESEND_API_KEY is missing in environment variables');
        return NextResponse.json(
          { error: 'Email service configuration error' },
          { status: 500 }
        );
      }

      const resend = new Resend(resendApiKey);
      const { data, error: resendError } = await resend.emails.send({
        from: 'RaiseGate <noreply@raisegate.com>',
        to: email,
        subject: 'Your Verification Code',
        text: `Your verification code is: ${verificationCode}`,
        html: `
            <div>
              <h2>Your Verification Code</h2>
              <p>Enter the following code to access the deck:</p>
              <h1 style="font-size: 2.5rem; letter-spacing: 0.5rem; color: #771144;">${verificationCode}</h1>
              <p>This code will expire in 10 minutes.</p>
            </div>
          `,
      });

      if (resendError) {
        console.error('Resend API Error:', resendError);
        return NextResponse.json(
          { error: 'Failed to send verification email' },
          { status: 500 }
        );
      }

      console.log('Email sent successfully:', data);

    } catch (emailError) {
      console.error('Failed to send email (exception):', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email'
    })

  } catch (err) {
    console.error('Request code error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
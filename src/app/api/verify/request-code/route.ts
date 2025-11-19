import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DeckShareLink } from '@/types/database'
import { Resend } from 'resend'
import { OTPStorage } from '@/lib/otp-storage'

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

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Store OTP using shared storage (with rate limiting)
    OTPStorage.set(token, verificationCode, email);

    // Send email via Resend
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: OTP is', verificationCode);
    }

    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
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
      } else {
        console.warn('RESEND_API_KEY not found, skipping email send');
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Log error but return success to client to avoid blocking flow if email service is down
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
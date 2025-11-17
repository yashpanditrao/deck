// app/api/access/request/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateOTP } from '@/services/otp.service';
import { Resend } from 'resend';
import { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

// Initialize Resend client inside the request handler
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set in environment variables');
  }
  return new Resend(apiKey);
}

type DeckShareLink = Database['public']['Tables']['deck_share_links']['Row'] & {
  deck?: {
    id: string;
    company_id: string;
    is_downloadable: boolean;
  } | null;
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: Request) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };


  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400, headers }
      );
    }

    // Get the share link with proper typing
    const { data, error } = await supabase
  .from('deck_share_links')
  .select(`
    *,
    deck:deck_id (id, company_id)
  `)
  .eq('token', token)
  .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Invalid or expired share link', details: error?.message },
        { status: 404, headers }
      );
    }

    const shareLink = data as DeckShareLink;

    // Check access control
    if (shareLink.allow_anonymous) {
      // Public access - no verification needed
      return NextResponse.json({ 
        success: true, 
        accessGranted: true,
        requiresVerification: false
      }, { headers });
    }

    // Check if email is whitelisted
    const allowedDomains = Array.isArray(shareLink.allowed_domains) ? shareLink.allowed_domains : [];
    const allowedEmails = Array.isArray(shareLink.allowed_emails) ? shareLink.allowed_emails : [];

    if (allowedDomains.length > 0 || allowedEmails.length > 0) {
      const emailDomain = email.split('@')[1];
      const isAllowed = 
        allowedEmails.includes(email) || 
        (emailDomain && allowedDomains.some(domain => email.endsWith(`@${domain}`)));

      if (!isAllowed) {
        return NextResponse.json(
          { error: 'This email is not authorized to access this deck' },
          { status: 403, headers }
        );
      }
    }

    // Generate OTP
    const result = await generateOTP(email, token);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate OTP' },
        { status: 500, headers }
      );
    }
    
    const otp = result.otp;

    // In development, log the OTP instead of sending an email
   // In development, log the OTP and optionally send test email
if (process.env.NODE_ENV === 'development') {
  // Development mode: OTP is returned in the response
  
  return NextResponse.json({ 
    success: true,
    message: 'Development mode: OTP logged to console and test email sent',
    otp
  }, { headers });
}

    // In production, send the OTP via email
    const resend = getResendClient();
    await resend.emails.send({
      from: 'RaiseGate <noreply@raisegate.com>',
      to: email,
      subject: 'Your Verification Code',
      text: `Your verification code is: ${otp}`,
      html: `
        <div>
          <h2>Your Verification Code</h2>
          <p>Enter the following code to access the deck:</p>
          <h1 style="font-size: 2.5rem; letter-spacing: 0.5rem; color: #2563eb;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Verification code sent to your email',
      requiresVerification: true
    }, { headers });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process OTP request',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500, headers }
    );
  }
}
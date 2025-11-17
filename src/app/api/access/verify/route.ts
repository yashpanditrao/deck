// src/app/api/access/verify/route.ts
import { NextResponse } from 'next/server';
import { verifyOTP } from '@/services/otp.service';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  try {
    const { email, token, otp } = await request.json();

    if (!email || !token || !otp) {
      return NextResponse.json(
        { error: 'Email, token, and OTP are required' },
        { status: 400, headers }
      );
    }

    const result = await verifyOTP(email, token, otp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Invalid or expired OTP' },
        { status: 400, headers }
      );
    }

    const { error: updateError } = await supabase
      .from('deck_share_links')
      .update({
        is_verified: true,
        updated_at: new Date().toISOString()
      } as never) // Type assertion to handle type mismatch
      .eq('token', token)
      .eq('recipient_email', email);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500, headers }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      accessGranted: true
    }, { headers });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to verify OTP',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers }
    );
  }
}

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
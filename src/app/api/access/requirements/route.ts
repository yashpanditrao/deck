// app/api/access/requirements/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type DeckShareLink = Database['public']['Tables']['deck_share_links']['Row'] & {
  deck: {
    id: string;
    company_id: string;
  } | null;
};

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  try {
    // Get the share link with related deck data
    console.log('Fetching requirements for token:', token);
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select(`
        *,
        deck:deck_id (id, company_id)
      `)
      .eq('token', token)
      .single() as { data: DeckShareLink | null; error: Error | null };

    if (error) {
      console.error('Supabase error fetching share link:', error);
    }
    if (!shareLink) {
      console.error('No share link found for token:', token);
    }

    if (error || !shareLink) {
      return NextResponse.json(
        { error: 'Invalid or expired share link' },
        { status: 404 }
      );
    }

    // Check if link is expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This share link has expired' },
        { status: 403 }
      );
    }

    // Map database fields to frontend requirements
    const accessLevel = shareLink.access_level || 'restricted';
    const requireVerification = shareLink.require_verification ?? true;
    const allowAnonymous = shareLink.allow_anonymous ?? false;
    const allowedDomains = shareLink.allowed_domains || [];
    const allowedEmails = shareLink.allowed_emails || [];

    return NextResponse.json({
      accessLevel,
      requireVerification,
      allowAnonymous,
      allowedDomains,
      allowedEmails,
      isDownloadable: shareLink.is_downloadable,
      expiresAt: shareLink.expires_at,
      deckId: shareLink.deck_id,
      companyId: shareLink.company_id
    });

  } catch (error) {
    console.error('Error fetching share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
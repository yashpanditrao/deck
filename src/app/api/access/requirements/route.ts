// app/api/access/requirements/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type DeckShareLink = Database['public']['Tables']['deck_share_links']['Row'] & {
  deck: {
    id: string;
    company_id: string;
    is_downloadable: boolean;
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
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select(`
        *,
        deck:deck_id (id, company_id, is_downloadable)
      `)
      .eq('token', token)
      .single() as { data: DeckShareLink | null; error: Error | null };

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

    // For now, we'll use the existing fields
    // Once the database is migrated, we can uncomment the new access level logic
    const accessLevel: 'public' | 'restricted' | 'whitelisted' = 'restricted';
    const requireVerification = true;
    const allowAnonymous = false;
    const allowedDomains: string[] = [];
    const allowedEmails: string[] = [];

    return NextResponse.json({
      accessLevel,
      requireVerification,
      allowAnonymous,
      allowedDomains,
      allowedEmails,
      isDownloadable: shareLink.deck?.is_downloadable === true,
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
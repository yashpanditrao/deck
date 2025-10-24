import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateSignedUrl } from '@/lib/supabase-storage'

interface ShareLinkWithDeckFile {
  id: string
  company_id: string
  recipient_email: string
  token: string
  verification_code: string | null
  verification_code_expires: string | null
  is_verified: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
  deck_id: string
  deck_files: {
    id: string
    file_path: string
    thumbnail_path: string
  }
}

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

    // Single optimized query with JOIN to get all needed data at once
    const { data: result, error } = await supabase
      .from('deck_share_links')
      .select(`
        id,
        company_id,
        recipient_email,
        token,
        verification_code,
        verification_code_expires,
        is_verified,
        expires_at,
        created_at,
        updated_at,
        deck_id,
        deck_files!inner (
          id,
          file_path,
          thumbnail_path
        )
      `)
      .eq('token', token)
      .single<ShareLinkWithDeckFile>()

    if (error || !result) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (result.expires_at && new Date(result.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 410 }
      )
    }

    // Generate signed URL for the deck file (1 hour expiration)
    try {
      const signedUrl = await generateSignedUrl(result.deck_files.file_path, 3600)

      return NextResponse.json({
        success: true,
        data: {
          deck_url: signedUrl,
          thumbnail_path: result.deck_files.thumbnail_path,
          recipient_email: result.recipient_email,
          is_verified: result.is_verified,
          expires_at: result.expires_at
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
    console.error('Deck view error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

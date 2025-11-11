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
  is_downloadable: boolean
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
        is_downloadable,
        expires_at,
        deck_files!inner (
          file_path
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

    // Only return minimal required data
    return NextResponse.json({
      success: true,
      is_downloadable: result.is_downloadable || false
    });

  } catch (err) {
    console.error('Deck view error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

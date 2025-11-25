import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { verifyAccessToken } from '@/lib/jwt'
import { getCachedPDF, cachePDF } from '@/lib/pdf-cache'

type DeckShareLink = Database['public']['Tables']['deck_share_links']['Row'] & {
  deck_files: {
    file_path: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const { searchParams } = new URL(request.url)
    const accessToken = searchParams.get('accessToken')

    if (!token) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get file path and access details from DB
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select(`
        *,
        deck_files!inner (
          file_path
        )
      `)
      .eq('token', token)
      .single() as { data: DeckShareLink | null, error: { message: string } | null }

    if (error || !shareLink || !shareLink.deck_files?.file_path) {
      return new NextResponse('File not found', { status: 404 })
    }

    // Check expiration
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return new NextResponse('Link expired', { status: 410 })
    }

    // Check Access Permissions
    const accessLevel = shareLink.access_level || 'restricted';

    if (accessLevel !== 'public') {
      // For Restricted/Whitelisted, we need a valid access token
      if (!accessToken) {
        return new NextResponse('Access token required', { status: 401 })
      }

      // Verify the JWT
      const payload = await verifyAccessToken(accessToken)

      if (!payload) {
        return new NextResponse('Invalid or expired access token', { status: 403 })
      }

      // Verify the token in the JWT matches the requested token
      if (payload.token !== token) {
        return new NextResponse('Token mismatch', { status: 403 })
      }

      // For whitelisted access, verify the email is still allowed
      if (accessLevel === 'whitelisted') {
        const allowedEmails = (shareLink.allowed_emails || []).map(e => e.toLowerCase())
        const allowedDomains = (shareLink.allowed_domains || []).map(d => d.toLowerCase())
        const userEmail = payload.email.toLowerCase()
        const userDomain = userEmail.split('@')[1]

        const isEmailAllowed = allowedEmails.includes(userEmail)
        const isDomainAllowed = allowedDomains.includes(userDomain)

        if (!isEmailAllowed && !isDomainAllowed) {
          return new NextResponse('Access revoked', { status: 403 })
        }
      }
    }

    const filePath = shareLink.deck_files.file_path
    console.log('Attempting to access file at path:', filePath)

    // Try to get PDF from cache first
    let buffer = await getCachedPDF(filePath)

    // If not in cache, fetch from Supabase and cache it
    if (!buffer) {
      console.log('Fetching PDF from Supabase storage...')
      
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('deck')
        .createSignedUrl(filePath, 60)

      if (urlError || !signedUrlData?.signedUrl) {
        return NextResponse.json(
          {
            error: 'Error generating file URL',
            details: urlError?.message || 'Unknown error',
            filePath
          },
          { status: 500 }
        )
      }

      // Fetch file content
      const fileResponse = await fetch(signedUrlData.signedUrl, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })

      if (!fileResponse.ok) {
        console.error('Error fetching file:', fileResponse.statusText)
        return new NextResponse('Error fetching file', { status: 500 })
      }

      const arrayBuffer = await fileResponse.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)

      if (buffer.length === 0) {
        throw new Error('Downloaded file is empty')
      }

      // Cache the PDF for 2 weeks
      await cachePDF(filePath, buffer)
    }

    // Serve PDF inline with browser caching enabled
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
        // Enable browser caching for 1 hour for faster subsequent loads
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Cache-Status': buffer ? 'HIT' : 'MISS'
      }
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

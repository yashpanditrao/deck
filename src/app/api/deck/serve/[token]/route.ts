import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface DeckFile {
  file_path: string;
}

// Deck file interface

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!token || !email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Verify email-token match
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/verify/email-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email })
    })

    if (!verifyResponse.ok) {
      return new NextResponse('Verification failed', { status: 403 })
    }

    // Get file path from DB
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select(`
        deck_files!inner (
          file_path
        )
      `)
      .eq('token', token)
      .single<{ deck_files: { file_path: string } }>()

    if (error || !shareLink?.deck_files?.file_path) {
      return new NextResponse('File not found', { status: 404 })
    }

    const filePath = shareLink.deck_files.file_path
    console.log('Attempting to access file at path:', filePath)

  
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
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      throw new Error('Downloaded file is empty')
    }

    // Serve PDF inline
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
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

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface ShareLinkWithDeckFile {
  deck_files: {
    file_path: string
  } | null
}

export async function GET(
  request: NextRequest,
  { params }: { params?: { token?: string } }
) {
  try {
    const token = params?.token
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!token || !email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Verify the email matches the token
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/verify/email-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email })
    })

    if (!verifyResponse.ok) {
      return new NextResponse('Verification failed', { status: 403 })
    }

    // Get the file path from the database
    const { data: shareLink, error } = await supabase
      .from('deck_share_links')
      .select(`
        deck_files!inner (
          file_path
        )
      `)
      .eq('token', token)
      .single<ShareLinkWithDeckFile>()

    if (error || !shareLink?.deck_files?.file_path) {
      return new NextResponse('File not found', { status: 404 })
    }

    const filePath = shareLink.deck_files.file_path;
    console.log('Attempting to access file at path:', filePath);
    
    try {
      // First, check if the file exists
      const { data: fileList, error: listError } = await supabase.storage
        .from('decks')
        .list('', { 
          limit: 100,
          search: filePath.split('/').pop() // Search by filename
        });

      if (listError) {
        console.error('Error listing files:', listError);
      } else if (fileList && fileList.length > 0) {
        console.log('Found matching files:', fileList);
      } else {
        console.log('No matching files found');
      }

      // Try to get a signed URL for the file
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('deck')
        .createSignedUrl(filePath, 60); // 1 minute expiration

      if (urlError || !signedUrlData?.signedUrl) {
        console.error('Error creating signed URL:', urlError);
        return new NextResponse(
          JSON.stringify({
            error: 'Error generating file URL',
            details: urlError?.message || 'Unknown error',
            filePath: filePath
          }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Now fetch the file using the signed URL
      const fileResponse = await fetch(signedUrlData.signedUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!fileResponse.ok) {
        console.error('Error fetching file:', fileResponse.statusText);
        return new NextResponse('Error fetching file', { status: 500 });
      }

      // Get the file as an ArrayBuffer
      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

    // Verify we have valid content
    if (buffer.length === 0) {
      throw new Error('Downloaded file is empty')
    }

    // Return the file data with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return new NextResponse(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new NextResponse(
      JSON.stringify({
        error: 'Internal server error',
        details: 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

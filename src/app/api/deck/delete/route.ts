import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function DELETE(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const deckId = searchParams.get('deckId')

    if (!deckId) {
      return NextResponse.json(
        { error: 'Deck ID is required' },
        { status: 400 }
      )
    }

    // Get deck file information and verify ownership
    const { data: deckFile, error: fetchError } = await supabaseAdmin
      .from('deck_files')
      .select('*')
      .eq('id', deckId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !deckFile) {
      return NextResponse.json(
        { error: 'Deck file not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete all share links associated with this deck
    await supabaseAdmin
      .from('deck_share_links')
      .delete()
      .eq('deck_id', deckId)
      .eq('user_id', user.id)

    // Delete the file from storage if it exists
    if (deckFile.file_path) {
      await supabaseAdmin.storage.from('deck').remove([deckFile.file_path])
    }

    // Delete thumbnail from storage if it exists
    if (deckFile.thumbnail_path) {
      const thumbnailFileName = deckFile.thumbnail_path.split('/').pop()
      if (thumbnailFileName) {
        await supabaseAdmin.storage.from('deckthumbnail').remove([thumbnailFileName])
      }
    }

    // Delete the database record
    const { error: deleteError } = await supabaseAdmin
      .from('deck_files')
      .delete()
      .eq('id', deckId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Database error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete deck file' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Deck file deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting deck:', error)
    return NextResponse.json(
      { error: 'Failed to delete deck' },
      { status: 500 }
    )
  }
}


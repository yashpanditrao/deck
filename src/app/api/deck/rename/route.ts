import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { deckId, newName } = await req.json()

    if (!deckId || !newName) {
      return NextResponse.json(
        { error: 'Deck ID and new name are required' },
        { status: 400 }
      )
    }

    // Sanitize the new name (remove special characters, keep only alphanumeric, spaces, hyphens, underscores)
    const sanitizedName = newName.replace(/[^a-zA-Z0-9\s\-_]/g, '_').trim()

    if (!sanitizedName) {
      return NextResponse.json(
        { error: 'Invalid deck name' },
        { status: 400 }
      )
    }

    // Get the deck file record and verify ownership
    const { data: deckFile, error: fetchError } = await supabaseAdmin
      .from('deck_files')
      .select('*')
      .eq('id', deckId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !deckFile) {
      console.error('Deck fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Deck not found or unauthorized' },
        { status: 404 }
      )
    }

    if (!deckFile.file_path) {
      return NextResponse.json(
        { error: 'Deck file path not found' },
        { status: 404 }
      )
    }

    // Parse the current file path: "email/Old_Name_timestamp.pdf"
    const pathParts = deckFile.file_path.split('/')
    const oldFileName = pathParts[pathParts.length - 1]
    const folderPath = pathParts.slice(0, -1).join('/')
    const fileExtension = oldFileName.split('.').pop()

    // Create new file name: "NewName_timestamp.pdf"
    const timestamp = Date.now()
    const newFileName = `${sanitizedName}_${timestamp}.${fileExtension}`
    const newFilePath = `${folderPath}/${newFileName}`

    console.log('Renaming deck:', {
      oldPath: deckFile.file_path,
      newPath: newFilePath
    })

    // Copy file to new location in storage
    const { data: copyData, error: copyError } = await supabaseAdmin.storage
      .from('deck')
      .copy(deckFile.file_path, newFilePath)

    if (copyError) {
      console.error('Storage copy error:', copyError)
      return NextResponse.json(
        { error: 'Failed to rename file in storage', details: copyError.message },
        { status: 500 }
      )
    }

    console.log('File copied successfully:', copyData)

    // Update database with new file path
    const { data: updatedDeck, error: updateError } = await supabaseAdmin
      .from('deck_files')
      .update({ file_path: newFilePath })
      .eq('id', deckId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      // Try to rollback: delete the copied file
      await supabaseAdmin.storage.from('deck').remove([newFilePath])
      return NextResponse.json(
        { error: 'Failed to update deck record', details: updateError.message },
        { status: 500 }
      )
    }

    // Delete old file from storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from('deck')
      .remove([deckFile.file_path])

    if (deleteError) {
      console.error('Old file deletion error (non-critical):', deleteError)
      // Don't fail the request - the rename was successful
    }

    console.log('Deck renamed successfully')

    return NextResponse.json({
      success: true,
      message: 'Deck renamed successfully',
      deckFile: updatedDeck
    })
  } catch (error: any) {
    console.error('Error renaming deck:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


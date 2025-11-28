import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all deck files for the authenticated user
    const { data: deckFiles, error } = await supabaseAdmin
      .from('deck_files')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Database error fetching deck files:', error)
      return NextResponse.json(
        { error: 'Failed to fetch deck files', details: error.message },
        { status: 500 }
      )
    }

    console.log(`Found ${deckFiles?.length || 0} deck files for user ${user.id}`)
    if (deckFiles && deckFiles.length > 0) {
      console.log('Deck files:', deckFiles.map(d => ({ id: d.id, file_path: d.file_path })))
    }

    return NextResponse.json({
      success: true,
      deckFiles: deckFiles || []
    })
  } catch (error) {
    console.error('Error fetching deck files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deck files' },
      { status: 500 }
    )
  }
}


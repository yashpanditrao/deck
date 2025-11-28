import { supabaseAdmin } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export type DeckUserProfile = {
  id: string
  username: string | null
  deck_id: string | null
  name: string | null
  email: string | null
}

const sanitizeUsername = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '').trim()
  return normalized.length > 0 ? normalized : `deck_user_${Date.now().toString(36)}`
}

const isRelationMissingError = (error?: { code?: string }) =>
  error?.code === '42P01' // relation does not exist

async function ensureNoteDevRecord(userId: string) {
  try {
    const { data: existingNote, error: existingNoteError } = await supabaseAdmin
      .from('note_dev')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (isRelationMissingError(existingNoteError)) {
      return
    }

    if (existingNoteError && existingNoteError.code !== 'PGRST116') {
      console.error('Failed to read note_dev entry:', existingNoteError)
      return
    }

    if (existingNote) {
      return
    }

    const { error: insertError } = await supabaseAdmin
      .from('note_dev')
      .insert({ id: userId, note: 'deck' })

    if (isRelationMissingError(insertError)) {
      return
    }

    if (insertError) {
      console.error('Failed to insert note_dev entry:', insertError)
    }
  } catch (error) {
    console.error('Unexpected note_dev error:', error)
  }
}

function buildUserInsertPayload(user: User): DeckUserProfile {
  const email = user.email ?? null
  const name =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null
  const preferredUsername =
    (user.user_metadata?.username as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    null
  const emailPrefix = email ? email.split('@')[0] : null
  const fallbackSource =
    emailPrefix ||
    preferredUsername ||
    name ||
    `deck_user_${user.id.slice(0, 8)}`
  const username = sanitizeUsername(fallbackSource)

  return {
    id: user.id,
    username,
    deck_id: null,
    name,
    email
  }
}

export async function getOrCreateDeckUser(user: User): Promise<DeckUserProfile> {
  const { data: existingUser, error: existingError } = await supabaseAdmin
    .from('users')
    .select('id, username, deck_id, name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError
  }

  if (existingUser?.username) {
    await ensureNoteDevRecord(user.id)
    return existingUser
  }

  const insertPayload = buildUserInsertPayload(user)
  const { data: createdUser, error: createError } = await supabaseAdmin
    .from('users')
    .insert(insertPayload)
    .select('id, username, deck_id, name, email')
    .single()

  if (createError || !createdUser) {
    console.error('Failed to create fallback user profile:', createError)
    throw createError ?? new Error('Unable to create user profile for deck upload')
  }

  await ensureNoteDevRecord(user.id)
  return createdUser
}

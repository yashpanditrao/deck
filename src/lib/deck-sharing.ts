import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type DeckShareLink = Database['public']['Tables']['deck_share_links']['Row']
export type DeckShareLinkInsert = Database['public']['Tables']['deck_share_links']['Insert']

export function generateShareToken(): string {
  return (
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
  )
}

export async function createDeckShareLink(
  client: SupabaseClient<Database>,
  data: DeckShareLinkInsert
): Promise<DeckShareLink> {
  const { data: shareLink, error } = await client
    .from('deck_share_links')
    .insert(data)
    .select()
    .single()

  if (error || !shareLink) {
    throw error ?? new Error('Failed to create share link')
  }

  return shareLink
}

import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { DmLobby, DmLobbyMode, Profile } from '../types/domain'

const PROFILE_SELECT = `
  id,
  username,
  user_code,
  avatar_url,
  bio,
  team_id,
  advanced_access_enabled,
  standoff_player_id,
  created_at
`

function throwIfError(error: PostgrestError | null) {
  if (error) throw error
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function normalizeLobby(raw: Record<string, unknown>): DmLobby {
  return {
    ...(raw as unknown as DmLobby),
    creator: unwrapRelation(raw.creator as Profile | Profile[] | null | undefined),
  }
}

export async function fetchActiveDmLobbies() {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('dm_lobbies')
    .select(`
      *,
      creator:profiles (
        ${PROFILE_SELECT}
      )
    `)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []).map((item) => normalizeLobby(item as Record<string, unknown>))
}

export async function createDmLobby(params: {
  creatorId: string
  mapId: string
  mode: DmLobbyMode
  headshotsOnly: boolean
  lobbyLink: string
}) {
  const { data, error } = await supabase
    .from('dm_lobbies')
    .insert({
      creator_id: params.creatorId,
      map_id: params.mapId,
      mode: params.mode,
      headshots_only: params.headshotsOnly,
      lobby_link: params.lobbyLink.trim(),
    })
    .select(`
      *,
      creator:profiles (
        ${PROFILE_SELECT}
      )
    `)
    .single()

  throwIfError(error)
  return normalizeLobby(data as Record<string, unknown>)
}

export function extractLobbyAccessId(lobbyLink: string) {
  const trimmed = lobbyLink.trim()
  if (!trimmed) return ''

  try {
    const parsed = new URL(trimmed)
    const queryKeys = ['lobby', 'room', 'match', 'id', 'code']
    for (const key of queryKeys) {
      const value = parsed.searchParams.get(key)
      if (value?.trim()) return value.trim()
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? trimmed
  } catch {
    return trimmed
  }
}

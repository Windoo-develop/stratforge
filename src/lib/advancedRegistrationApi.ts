import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { AdvancedRegistrationPayload, AdvancedRegistrationRequest, Profile } from '../types/domain'

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

function normalizePayload(value: unknown): AdvancedRegistrationPayload {
  const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {}

  return {
    standoff_player_id:
      typeof payload.standoff_player_id === 'string' ? payload.standoff_player_id : '',
    stats_screenshot_url:
      typeof payload.stats_screenshot_url === 'string' ? payload.stats_screenshot_url : null,
  }
}

function normalizeRequest(raw: Record<string, unknown>): AdvancedRegistrationRequest {
  return {
    ...(raw as unknown as AdvancedRegistrationRequest),
    payload: normalizePayload(raw.payload),
    user: unwrapRelation(raw.user as Profile | Profile[] | null | undefined),
    reviewer: unwrapRelation(raw.reviewer as Profile | Profile[] | null | undefined),
  }
}

export async function fetchMyAdvancedRegistrationRequest(userId: string) {
  const { data, error } = await supabase
    .from('advanced_registration_requests')
    .select(`
      *,
      user:profiles!advanced_registration_requests_user_id_fkey (
        ${PROFILE_SELECT}
      ),
      reviewer:profiles!advanced_registration_requests_reviewed_by_fkey (
        ${PROFILE_SELECT}
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfError(error)
  return data ? normalizeRequest(data as Record<string, unknown>) : null
}

export async function isStandoffPlayerIdAvailable(playerId: string, userId?: string) {
  const { data, error } = await supabase.rpc('is_standoff_player_id_available', {
    p_player_id: playerId.trim(),
    p_user_id: userId ?? null,
  })

  throwIfError(error)
  return Boolean(data)
}

export async function submitAdvancedRegistrationRequest(params: {
  userId: string
  email: string
  standoffPlayerId: string
  statsScreenshotUrl: string | null
}) {
  const { error } = await supabase.from('advanced_registration_requests').insert({
    user_id: params.userId,
    email: params.email.toLowerCase(),
    payload: {
      standoff_player_id: params.standoffPlayerId.trim(),
      stats_screenshot_url: params.statsScreenshotUrl,
    },
  })

  throwIfError(error)
}

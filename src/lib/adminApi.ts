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

export async function fetchAdvancedRegistrationRequests(status: AdvancedRegistrationRequest['status'] = 'pending') {
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
    .eq('status', status)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []).map((item) => normalizeRequest(item as Record<string, unknown>))
}

export async function reviewAdvancedRegistrationRequest(params: {
  requestId: string
  status: AdvancedRegistrationRequest['status']
  adminNotes: string
}) {
  const { error } = await supabase.rpc('review_advanced_registration_request', {
    p_request_id: params.requestId,
    p_status: params.status,
    p_admin_notes: params.adminNotes.trim() || null,
  })

  throwIfError(error)
}

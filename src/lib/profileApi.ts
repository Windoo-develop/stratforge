import type { PostgrestError, User } from '@supabase/supabase-js'
import {
  buildStoragePath,
  isBucketNotFoundError,
  uploadDataUrlToBucketList,
} from './storage'
import { supabase } from './supabaseClient'
import type { Profile, ProfileWithTeam } from '../types/domain'

const PENDING_PROFILE_KEY = 'stratforge-pending-profile'
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/

type PendingProfileDraft = {
  email: string
  username: string
  bio: string
  avatarUrl: string | null
  avatarDataUrl: string | null
  avatarFileName: string | null
}

function throwIfError(error: PostgrestError | null) {
  if (error) throw error
}

export function isProfilesSchemaUnavailable(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : ''

  return /public\.profiles|schema cache/i.test(message)
}

function safeSessionStorage() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username)
}

export function buildFallbackProfile(user: User): Profile {
  const username = resolveUsernameCandidate(user)
  const userCode =
    typeof user.user_metadata?.user_code === 'string' && user.user_metadata.user_code.trim()
      ? user.user_metadata.user_code
      : user.id.slice(0, 8).toUpperCase()

  return {
    id: user.id,
    username,
    user_code: userCode,
    avatar_url: getMetadataString(user, 'avatar_url'),
    bio: getMetadataString(user, 'bio'),
    team_id: null,
    advanced_access_enabled: false,
    standoff_player_id: null,
    created_at: user.created_at ?? new Date().toISOString(),
  }
}

function normalizeUsername(username: string) {
  const sanitized = username
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)

  return sanitized.length >= 3 ? sanitized : 'player'
}

export async function isUsernameAvailable(username: string, excludedUserId?: string) {
  const normalized = username.trim()
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .limit(1)

  throwIfError(error)

  if (!data?.length) return true
  return Boolean(excludedUserId && data[0]?.id === excludedUserId)
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  throwIfError(error)
  return data as Profile
}

export async function resolveProfileForUser(user: User) {
  try {
    return await fetchProfile(user.id)
  } catch (error) {
    if (isProfilesSchemaUnavailable(error)) {
      return buildFallbackProfile(user)
    }

    throw error
  }
}

export async function fetchProfileWithTeam(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      user_code,
      avatar_url,
      bio,
      team_id,
      advanced_access_enabled,
      standoff_player_id,
      created_at
    `)
    .eq('id', profileId)
    .single()

  throwIfError(error)
  if (!data) {
    throw new Error('Profile not found')
  }

  let resolvedTeamId = data.team_id

  if (!resolvedTeamId) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', profileId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    resolvedTeamId = (membership?.team_id as string | null | undefined) ?? null
  }

  if (!resolvedTeamId) {
    return {
      ...data,
      team_id: null,
      team: null,
    } as ProfileWithTeam
  }

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      avatar_url,
      creator_id,
      created_at
    `)
    .eq('id', resolvedTeamId)
    .maybeSingle()

  if (teamError) {
    return {
      ...data,
      team_id: resolvedTeamId,
      team: null,
    } as ProfileWithTeam
  }

  return {
    ...data,
    team_id: resolvedTeamId,
    team: team ?? null,
  } as ProfileWithTeam
}

export async function upsertProfile(payload: {
  id: string
  username: string
  avatar_url?: string | null
  bio?: string | null
}) {
  const { error } = await supabase.from('profiles').upsert({
    id: payload.id,
    username: payload.username.trim(),
    avatar_url: payload.avatar_url ?? null,
    bio: payload.bio?.trim() ? payload.bio.trim() : null,
  })

  throwIfError(error)
}

export async function updateProfileDetails(payload: {
  id: string
  avatar_url?: string | null
  bio?: string | null
}) {
  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: payload.avatar_url ?? null,
      bio: payload.bio?.trim() ? payload.bio.trim() : null,
    })
    .eq('id', payload.id)

  throwIfError(error)
}

export function storePendingProfileDraft(draft: PendingProfileDraft) {
  const storage = safeSessionStorage()
  if (!storage) return
  storage.setItem(PENDING_PROFILE_KEY, JSON.stringify(draft))
}

export function clearPendingProfileDraft() {
  const storage = safeSessionStorage()
  if (!storage) return
  storage.removeItem(PENDING_PROFILE_KEY)
}

function readPendingProfileDraft() {
  const storage = safeSessionStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(PENDING_PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingProfileDraft
  } catch {
    return null
  }
}

function getMetadataString(user: User, key: string) {
  const value = user.user_metadata?.[key]
  return typeof value === 'string' ? value : null
}

function resolveUsernameCandidate(user: User) {
  const fromMetadata = getMetadataString(user, 'username')
  if (fromMetadata) return normalizeUsername(fromMetadata)
  const emailPrefix = user.email?.split('@')[0] ?? 'player'
  return normalizeUsername(emailPrefix)
}

export async function ensureProfileForUser(user: User) {
  try {
    return await fetchProfile(user.id)
  } catch (error) {
    if (isProfilesSchemaUnavailable(error)) {
      return buildFallbackProfile(user)
    }

    const username = resolveUsernameCandidate(user)
    const bio = getMetadataString(user, 'bio')
    const avatarUrl = getMetadataString(user, 'avatar_url')

    const normalizedUsername = normalizeUsername(username)
    const available = await isUsernameAvailable(normalizedUsername, user.id)
    const safeUsername = available
      ? normalizedUsername
      : normalizeUsername(`${normalizedUsername.slice(0, 25)}_${user.id.slice(0, 4)}`)

    await upsertProfile({
      id: user.id,
      username: safeUsername,
      bio,
      avatar_url: avatarUrl,
    })

    return fetchProfile(user.id)
  }
}

export async function finalizePendingProfileDraft(user: User) {
  const draft = readPendingProfileDraft()
  if (!draft) return
  if (draft.email.toLowerCase() !== (user.email ?? '').toLowerCase()) return

  let avatarUrl = draft.avatarUrl

  if (draft.avatarDataUrl && draft.avatarFileName) {
    const storagePath = buildStoragePath(`profiles/${user.id}`, draft.avatarFileName)
    try {
      avatarUrl = await uploadDataUrlToBucketList(['avatars', 'team-avatars'], storagePath, draft.avatarDataUrl)
    } catch (error) {
      if (!isBucketNotFoundError(error)) {
        throw error
      }
    }
  }

  await upsertProfile({
    id: user.id,
    username: draft.username,
    bio: draft.bio,
    avatar_url: avatarUrl,
  })

  clearPendingProfileDraft()
}

export function buildFallbackProfileWithTeam(user: User): ProfileWithTeam {
  return {
    ...buildFallbackProfile(user),
    team: null,
  }
}

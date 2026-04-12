import { hash } from 'bcryptjs'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type {
  Lineup,
  LineupComment,
  Profile,
  Strat,
  StratComment,
  StratReplayStep,
  StratTrainingChecklistItem,
  StratVersion,
  StratVersionSnapshot,
  Team,
  TeamInvite,
  TeamMember,
} from '../types/domain'
import type { SceneState } from '../types/editor'

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

const TEAM_SELECT = `
  id,
  name,
  avatar_url,
  creator_id,
  created_at
`

const AUTHOR_PROFILE_SELECT = `
  *,
  author:profiles (
    ${PROFILE_SELECT}
  )
`

export type DashboardBundle = {
  team: Team
  membership: TeamMember | null
  roster: TeamMember[]
}

export type LineupMutation = Omit<Lineup, 'id' | 'created_at' | 'author'>
export type StratMutation = Omit<Strat, 'id' | 'created_at' | 'author' | 'linked_lineups'>

function throwIfError(error: PostgrestError | null) {
  if (error) throw error
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function isCreateTeamFunctionUnavailable(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : ''

  return /function public\.create_team|schema cache/i.test(message)
}

function mergeTeamsByMembershipOrder(teamIds: string[], teams: Team[]) {
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  return teamIds.map((teamId) => teamsById.get(teamId)).filter(Boolean) as Team[]
}

function normalizeScene(value: unknown): SceneState {
  if (!value || typeof value !== 'object') {
    return { entities: [], paths: [] }
  }

  const maybeScene = value as Partial<SceneState>

  return {
    entities: Array.isArray(maybeScene.entities) ? maybeScene.entities : [],
    paths: Array.isArray(maybeScene.paths) ? maybeScene.paths : [],
  }
}

function normalizeReplaySteps(value: unknown): StratReplayStep[] {
  if (!Array.isArray(value)) return []

  return value.map((rawStep, index) => {
    const step = rawStep && typeof rawStep === 'object' ? rawStep as Record<string, unknown> : {}

    return {
      id: typeof step.id === 'string' && step.id ? step.id : `step-${index + 1}`,
      title: typeof step.title === 'string' && step.title.trim() ? step.title : `Step ${index + 1}`,
      note: typeof step.note === 'string' ? step.note : null,
      scene: normalizeScene(step.scene),
    }
  })
}

function normalizeTrainingChecklist(value: unknown, replaySteps: StratReplayStep[]): StratTrainingChecklistItem[] {
  if (!Array.isArray(value)) return []

  const replayStepIds = new Set(replaySteps.map((step) => step.id))

  return value.map((rawItem, index) => {
    const item = rawItem && typeof rawItem === 'object' ? rawItem as Record<string, unknown> : {}
    const stepId = typeof item.step_id === 'string' && replayStepIds.has(item.step_id) ? item.step_id : null
    const rolePreset = typeof item.role_preset === 'string' && item.role_preset.trim() ? item.role_preset : null

    return {
      id: typeof item.id === 'string' && item.id ? item.id : `task-${index + 1}`,
      title: typeof item.title === 'string' && item.title.trim() ? item.title : `Task ${index + 1}`,
      note: typeof item.note === 'string' ? item.note : null,
      role_preset: rolePreset as StratTrainingChecklistItem['role_preset'],
      step_id: stepId,
    }
  })
}

function normalizeStratVersionSnapshot(value: unknown): StratVersionSnapshot {
  const snapshot = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const replaySteps = normalizeReplaySteps(snapshot.replay_steps)

  return {
    map: typeof snapshot.map === 'string' ? snapshot.map : '',
    name: typeof snapshot.name === 'string' ? snapshot.name : 'Untitled strat',
    note: typeof snapshot.note === 'string' ? snapshot.note : null,
    video_url: typeof snapshot.video_url === 'string' ? snapshot.video_url : null,
    side: snapshot.side === 'CT' ? 'CT' : 'T',
    types: Array.isArray(snapshot.types) ? (snapshot.types as string[]) : [],
    anchor_ids: Array.isArray(snapshot.anchor_ids) ? (snapshot.anchor_ids as string[]) : [],
    replay_steps: replaySteps,
    training_checklist: normalizeTrainingChecklist(snapshot.training_checklist, replaySteps),
    linked_lineup_ids: Array.isArray(snapshot.linked_lineup_ids) ? (snapshot.linked_lineup_ids as string[]) : [],
  }
}

function normalizeLineup(raw: Record<string, unknown>): Lineup {
  return {
    ...(raw as unknown as Lineup),
    anchor_ids: Array.isArray(raw.anchor_ids) ? (raw.anchor_ids as string[]) : [],
    author: unwrapRelation(raw.author as Profile | Profile[] | null | undefined),
  }
}

function normalizeStrat(raw: Record<string, unknown>, linkedLineups: Lineup[] = []): Strat {
  const replaySteps = normalizeReplaySteps(raw.replay_steps)

  return {
    ...(raw as unknown as Strat),
    anchor_ids: Array.isArray(raw.anchor_ids) ? (raw.anchor_ids as string[]) : [],
    author: unwrapRelation(raw.author as Profile | Profile[] | null | undefined),
    replay_steps: replaySteps,
    training_checklist: normalizeTrainingChecklist(raw.training_checklist, replaySteps),
    linked_lineups: linkedLineups,
  }
}

function normalizeComment<TComment extends LineupComment | StratComment>(raw: Record<string, unknown>) {
  return {
    ...(raw as unknown as TComment),
    author: unwrapRelation(raw.author as Profile | Profile[] | null | undefined),
  } as TComment
}

function normalizeStratVersion(raw: Record<string, unknown>): StratVersion {
  return {
    ...(raw as unknown as StratVersion),
    snapshot: normalizeStratVersionSnapshot(raw.snapshot),
    author: unwrapRelation(raw.author as Profile | Profile[] | null | undefined),
  }
}

function serializeStratSnapshot(strat: Strat): StratVersionSnapshot {
  return {
    map: strat.map,
    name: strat.name,
    note: strat.note,
    video_url: strat.video_url,
    side: strat.side,
    types: [...strat.types],
    anchor_ids: [...strat.anchor_ids],
    replay_steps: strat.replay_steps.map((step) => ({
      id: step.id,
      title: step.title,
      note: step.note,
      scene: step.scene,
    })),
    training_checklist: strat.training_checklist.map((item) => ({
      id: item.id,
      title: item.title,
      note: item.note,
      role_preset: item.role_preset,
      step_id: item.step_id,
    })),
    linked_lineup_ids: (strat.linked_lineups ?? []).map((lineup) => lineup.id),
  }
}

async function fetchLinkedLineupsMap(stratIds: string[]) {
  if (!stratIds.length) return new Map<string, Lineup[]>()

  const { data, error } = await supabase
    .from('strat_lineups')
    .select(`
      strat_id,
      sort_order,
      lineup:lineups (
        *,
        author:profiles (
          ${PROFILE_SELECT}
        )
      )
    `)
    .in('strat_id', stratIds)
    .order('sort_order', { ascending: true })

  throwIfError(error)

  const linkedByStrat = new Map<string, Lineup[]>()

  for (const entry of data ?? []) {
    const lineupRaw = unwrapRelation(
      entry.lineup as Record<string, unknown> | Record<string, unknown>[] | null | undefined,
    )

    if (!lineupRaw || !entry.strat_id) continue

    const current = linkedByStrat.get(entry.strat_id as string) ?? []
    current.push(normalizeLineup(lineupRaw))
    linkedByStrat.set(entry.strat_id as string, current)
  }

  return linkedByStrat
}

async function fetchStratById(stratId: string) {
  const { data, error } = await supabase
    .from('strats')
    .select(AUTHOR_PROFILE_SELECT)
    .eq('id', stratId)
    .maybeSingle()

  throwIfError(error)

  if (!data) {
    throw new Error('Strat not found')
  }

  const linkedByStrat = await fetchLinkedLineupsMap([stratId])
  return normalizeStrat(data as Record<string, unknown>, linkedByStrat.get(stratId) ?? [])
}

async function fetchComments<TComment extends LineupComment | StratComment>(
  table: 'lineup_comments' | 'strat_comments',
  foreignKey: 'lineup_id' | 'strat_id',
  contentId: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select(`
      *,
      author:profiles (
        ${PROFILE_SELECT}
      )
    `)
    .eq(foreignKey, contentId)
    .order('created_at', { ascending: true })

  throwIfError(error)
  return (data ?? []).map((item) => normalizeComment<TComment>(item as Record<string, unknown>))
}

async function createComment(
  table: 'lineup_comments' | 'strat_comments',
  payload: Record<string, string>,
) {
  const { error } = await supabase.from(table).insert(payload)
  throwIfError(error)
}

export async function fetchMyTeams(profileId: string) {
  const { data: memberships, error } = await supabase
    .from('team_members')
    .select('team_id, joined_at')
    .eq('user_id', profileId)
    .order('joined_at', { ascending: false })

  throwIfError(error)

  const teamIds = (memberships ?? []).map((item) => item.team_id as string).filter(Boolean)
  if (!teamIds.length) return []

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .in('id', teamIds)

  throwIfError(teamsError)
  return mergeTeamsByMembershipOrder(teamIds, (teams ?? []) as Team[])
}

export async function fetchPendingInvites(userCode: string) {
  const { data: invites, error } = await supabase
    .from('team_invites')
    .select('id, team_id, invitee_user_code, status, created_at')
    .eq('invitee_user_code', userCode)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  throwIfError(error)

  const teamIds = Array.from(new Set((invites ?? []).map((invite) => invite.team_id as string).filter(Boolean)))
  if (!teamIds.length) {
    return (invites ?? []) as TeamInvite[]
  }

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .in('id', teamIds)

  throwIfError(teamsError)

  const teamsById = new Map(((teams ?? []) as Team[]).map((team) => [team.id, team]))
  return (invites ?? []).map((invite) => ({
    ...invite,
    team: teamsById.get(invite.team_id as string),
  })) as TeamInvite[]
}

export async function createTeam(params: {
  name: string
  avatarUrl?: string | null
  password: string
}) {
  const { data, error } = await supabase.rpc('create_team', {
    p_avatar_url: params.avatarUrl ?? null,
    p_name: params.name,
    p_password: params.password,
  })

  if (!error) {
    return data as string
  }

  if (!isCreateTeamFunctionUnavailable(error)) {
    throw error
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const passwordHash = await hash(params.password, 10)
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name: params.name,
      avatar_url: params.avatarUrl ?? null,
      password_hash: passwordHash,
      creator_id: user.id,
    })
    .select('id')
    .single()

  throwIfError(teamError)
  if (!team) {
    throw new Error('Team creation failed')
  }

  const { error: membershipError } = await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: user.id,
    role: 'Creator',
    can_add_lineups: true,
    can_add_strats: true,
  })

  throwIfError(membershipError)
  return team.id as string
}

export async function joinTeam(params: { name: string; password: string }) {
  const { data, error } = await supabase.rpc('join_team_with_password', {
    p_name: params.name,
    p_password: params.password,
  })

  throwIfError(error)
  return data as string
}

export async function acceptInvite(inviteId: string) {
  const { data, error } = await supabase.rpc('accept_team_invite', {
    p_invite_id: inviteId,
  })

  throwIfError(error)
  return data as string
}

export async function fetchTeamDashboard(teamId: string, profileId: string): Promise<DashboardBundle> {
  const [
    { data: membership, error: membershipError },
    { data: team, error: teamError },
    { data: roster, error: rosterError },
  ] = await Promise.all([
    supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        user_id,
        role,
        role_preset,
        can_add_lineups,
        can_add_strats,
        joined_at
      `)
      .eq('team_id', teamId)
      .eq('user_id', profileId)
      .maybeSingle(),
    supabase
      .from('teams')
      .select(TEAM_SELECT)
      .eq('id', teamId)
      .maybeSingle(),
    supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        user_id,
        role,
        role_preset,
        can_add_lineups,
        can_add_strats,
        joined_at
      `)
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true }),
  ])

  throwIfError(membershipError)
  throwIfError(teamError)
  throwIfError(rosterError)

  if (!membership || !team) {
    throw new Error('Team not found or access denied.')
  }

  const userIds = Array.from(new Set((roster ?? []).map((member) => member.user_id as string).filter(Boolean)))
  let profilesById = new Map<string, Profile>()

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .in('id', userIds)

    throwIfError(profilesError)
    profilesById = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]))
  }

  const typedRoster = (roster ?? []).map((member) => ({
    ...(member as TeamMember),
    profile: profilesById.get(member.user_id as string),
  })) as TeamMember[]

  return {
    team: team as Team,
    membership: (membership as TeamMember) ?? null,
    roster: typedRoster,
  }
}

export async function updateMember(memberId: string, patch: Partial<TeamMember>) {
  const { error } = await supabase.from('team_members').update(patch).eq('id', memberId)
  throwIfError(error)
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from('team_members').delete().eq('id', memberId)
  throwIfError(error)
}

export async function disbandTeam(teamId: string, creatorId: string) {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .neq('user_id', creatorId)

  throwIfError(error)
}

export async function deleteTeam(teamId: string) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  throwIfError(error)
}

export async function createInvite(teamId: string, inviteeUserCode: string) {
  const { error } = await supabase.from('team_invites').insert({
    team_id: teamId,
    invitee_user_code: inviteeUserCode.toUpperCase(),
  })

  throwIfError(error)
}

export async function fetchLineups(teamId: string, map: string) {
  const { data, error } = await supabase
    .from('lineups')
    .select(AUTHOR_PROFILE_SELECT)
    .eq('team_id', teamId)
    .eq('map', map)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []).map((item) => normalizeLineup(item as Record<string, unknown>))
}

export async function fetchFavoriteLineupIds(userId: string, lineupIds: string[]) {
  const uniqueLineupIds = Array.from(new Set(lineupIds.filter(Boolean)))
  if (!uniqueLineupIds.length) return []

  const { data, error } = await supabase
    .from('lineup_favorites')
    .select('lineup_id')
    .eq('user_id', userId)
    .in('lineup_id', uniqueLineupIds)

  throwIfError(error)
  return (data ?? []).map((item) => item.lineup_id as string)
}

export async function addLineupFavorite(lineupId: string, userId: string) {
  const { error } = await supabase.from('lineup_favorites').insert({
    lineup_id: lineupId,
    user_id: userId,
  })

  throwIfError(error)
}

export async function removeLineupFavorite(lineupId: string, userId: string) {
  const { error } = await supabase
    .from('lineup_favorites')
    .delete()
    .eq('lineup_id', lineupId)
    .eq('user_id', userId)

  throwIfError(error)
}

export async function fetchStrats(teamId: string, map: string) {
  const { data, error } = await supabase
    .from('strats')
    .select(AUTHOR_PROFILE_SELECT)
    .eq('team_id', teamId)
    .eq('map', map)
    .order('created_at', { ascending: false })

  throwIfError(error)

  const rawStrats = (data ?? []) as Record<string, unknown>[]
  const linkedByStrat = await fetchLinkedLineupsMap(rawStrats.map((item) => item.id as string))

  return rawStrats.map((item) =>
    normalizeStrat(item, linkedByStrat.get(item.id as string) ?? []),
  )
}

export async function fetchStratVersions(stratId: string) {
  const { data, error } = await supabase
    .from('strat_versions')
    .select(`
      *,
      author:profiles (
        ${PROFILE_SELECT}
      )
    `)
    .eq('strat_id', stratId)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []).map((item) => normalizeStratVersion(item as Record<string, unknown>))
}

export async function createLineup(payload: LineupMutation) {
  const { error } = await supabase.from('lineups').insert(payload)
  throwIfError(error)
}

export async function updateLineup(lineupId: string, patch: Partial<LineupMutation>) {
  const { error } = await supabase.from('lineups').update(patch).eq('id', lineupId)
  throwIfError(error)
}

export async function deleteLineup(lineupId: string) {
  const { error } = await supabase.from('lineups').delete().eq('id', lineupId)
  throwIfError(error)
}

export async function createStrat(payload: StratMutation) {
  const { data, error } = await supabase.from('strats').insert(payload).select('id').single()
  throwIfError(error)

  if (!data?.id) {
    throw new Error('Strat creation failed')
  }

  return data.id as string
}

export async function recordStratVersion(stratId: string, createdBy: string | null) {
  const strat = await fetchStratById(stratId)
  const { error } = await supabase.from('strat_versions').insert({
    strat_id: stratId,
    team_id: strat.team_id,
    created_by: createdBy,
    snapshot: serializeStratSnapshot(strat),
  })

  throwIfError(error)
}

export async function updateStrat(stratId: string, patch: Partial<StratMutation>) {
  const { error } = await supabase.from('strats').update(patch).eq('id', stratId)
  throwIfError(error)
}

export async function deleteStrat(stratId: string) {
  const { error } = await supabase.from('strats').delete().eq('id', stratId)
  throwIfError(error)
}

export async function replaceStratLinkedLineups(stratId: string, lineupIds: string[]) {
  const uniqueLineupIds = Array.from(new Set(lineupIds))

  const { error: deleteError } = await supabase.from('strat_lineups').delete().eq('strat_id', stratId)
  throwIfError(deleteError)

  if (!uniqueLineupIds.length) return

  const { error } = await supabase.from('strat_lineups').insert(
    uniqueLineupIds.map((lineupId, index) => ({
      strat_id: stratId,
      lineup_id: lineupId,
      sort_order: index,
    })),
  )

  throwIfError(error)
}

export async function restoreStratVersion(versionId: string, createdBy: string | null) {
  const { data, error } = await supabase
    .from('strat_versions')
    .select('id, strat_id, snapshot')
    .eq('id', versionId)
    .maybeSingle()

  throwIfError(error)

  if (!data) {
    throw new Error('Version not found')
  }

  const snapshot = normalizeStratVersionSnapshot(data.snapshot)
  const stratId = data.strat_id as string

  await updateStrat(stratId, {
    map: snapshot.map,
    name: snapshot.name,
    note: snapshot.note,
    video_url: snapshot.video_url,
    side: snapshot.side,
    types: snapshot.types,
    anchor_ids: snapshot.anchor_ids,
    replay_steps: snapshot.replay_steps,
    training_checklist: snapshot.training_checklist,
  })
  await replaceStratLinkedLineups(stratId, snapshot.linked_lineup_ids)
  await recordStratVersion(stratId, createdBy)

  return stratId
}

export async function fetchLineupComments(lineupId: string) {
  return fetchComments<LineupComment>('lineup_comments', 'lineup_id', lineupId)
}

export async function createLineupComment(payload: {
  lineupId: string
  teamId: string
  authorId: string
  body: string
}) {
  await createComment('lineup_comments', {
    lineup_id: payload.lineupId,
    team_id: payload.teamId,
    author_id: payload.authorId,
    body: payload.body.trim(),
  })
}

export async function deleteLineupComment(commentId: string) {
  const { error } = await supabase.from('lineup_comments').delete().eq('id', commentId)
  throwIfError(error)
}

export async function fetchStratComments(stratId: string) {
  return fetchComments<StratComment>('strat_comments', 'strat_id', stratId)
}

export async function createStratComment(payload: {
  stratId: string
  teamId: string
  authorId: string
  body: string
}) {
  await createComment('strat_comments', {
    strat_id: payload.stratId,
    team_id: payload.teamId,
    author_id: payload.authorId,
    body: payload.body.trim(),
  })
}

export async function deleteStratComment(commentId: string) {
  const { error } = await supabase.from('strat_comments').delete().eq('id', commentId)
  throwIfError(error)
}

export function toProfileMap(roster: TeamMember[]) {
  return new Map(roster.map((member) => [member.user_id, member.profile as Profile]))
}

import { hash } from 'bcryptjs'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Lineup, Profile, Strat, Team, TeamInvite, TeamMember } from '../types/domain'

export type DashboardBundle = {
  team: Team
  membership: TeamMember | null
  roster: TeamMember[]
}

function throwIfError(error: PostgrestError | null) {
  if (error) throw error
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
    .select(`
      id,
      name,
      avatar_url,
      creator_id,
      created_at
    `)
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
    .select(`
      id,
      name,
      avatar_url,
      creator_id,
      created_at
    `)
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
  const [{ data: membership, error: membershipError }, { data: team, error: teamError }, { data: roster, error: rosterError }] =
    await Promise.all([
      supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          user_id,
          role,
          can_add_lineups,
          can_add_strats,
          joined_at
        `)
        .eq('team_id', teamId)
        .eq('user_id', profileId)
        .maybeSingle(),
      supabase
        .from('teams')
        .select(`
          id,
          name,
          avatar_url,
          creator_id,
          created_at
        `)
        .eq('id', teamId)
        .maybeSingle(),
    supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        user_id,
        role,
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
      .select(`
        id,
        username,
        user_code,
        avatar_url,
        bio,
        team_id,
        created_at
      `)
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
    .select(`
      *,
      author:profiles (
        id,
        username,
        user_code,
        avatar_url,
        bio,
        team_id,
        created_at
      )
    `)
    .eq('team_id', teamId)
    .eq('map', map)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []).map((item) => ({
    ...item,
    author: Array.isArray(item.author)
      ? (item.author[0] as Profile | undefined)
      : (item.author as Profile | undefined),
  })) as Lineup[]
}

export async function fetchStrats(teamId: string, map: string) {
  const { data, error } = await supabase
    .from('strats')
    .select(`
      *,
      author:profiles (
        id,
        username,
        user_code,
        avatar_url,
        bio,
        team_id,
        created_at
      )
    `)
    .eq('team_id', teamId)
    .eq('map', map)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []).map((item) => ({
    ...item,
    author: Array.isArray(item.author)
      ? (item.author[0] as Profile | undefined)
      : (item.author as Profile | undefined),
  })) as Strat[]
}

export async function createLineup(payload: Omit<Lineup, 'id' | 'created_at' | 'author'>) {
  const { error } = await supabase.from('lineups').insert(payload)
  throwIfError(error)
}

export async function updateLineup(lineupId: string, patch: Partial<Lineup>) {
  const { error } = await supabase.from('lineups').update(patch).eq('id', lineupId)
  throwIfError(error)
}

export async function deleteLineup(lineupId: string) {
  const { error } = await supabase.from('lineups').delete().eq('id', lineupId)
  throwIfError(error)
}

export async function createStrat(payload: Omit<Strat, 'id' | 'created_at' | 'author'>) {
  const { error } = await supabase.from('strats').insert(payload)
  throwIfError(error)
}

export async function updateStrat(stratId: string, patch: Partial<Strat>) {
  const { error } = await supabase.from('strats').update(patch).eq('id', stratId)
  throwIfError(error)
}

export async function deleteStrat(stratId: string) {
  const { error } = await supabase.from('strats').delete().eq('id', stratId)
  throwIfError(error)
}

export function toProfileMap(roster: TeamMember[]) {
  return new Map(roster.map((member) => [member.user_id, member.profile as Profile]))
}

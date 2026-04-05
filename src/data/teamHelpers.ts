import type { Team, TeamMember } from '../types/domain'

export function isTeamCreator(team: Team | null, profileId?: string | null) {
  return Boolean(team && profileId && team.creator_id === profileId)
}

export function canAddLineups(member: TeamMember | null, creator = false) {
  return creator || Boolean(member?.can_add_lineups)
}

export function canAddStrats(member: TeamMember | null, creator = false) {
  return creator || Boolean(member?.can_add_strats)
}

export function canEditOwnContent(member: TeamMember | null, creator = false, authorId?: string, profileId?: string | null, permission?: 'lineups' | 'strats') {
  if (creator) return true
  if (!member || !profileId || !authorId || authorId !== profileId) return false
  if (permission === 'lineups') return member.can_add_lineups
  if (permission === 'strats') return member.can_add_strats
  return false
}

import type { Profile } from '../types/domain'

export function hasAdvancedAccess(profile: Pick<Profile, 'advanced_access_enabled' | 'standoff_player_id'> | null | undefined) {
  return Boolean(profile?.advanced_access_enabled && profile.standoff_player_id?.trim())
}

import type { SceneState } from './editor'

export type TeamRolePreset = 'igl' | 'entry' | 'support' | 'lurker' | 'awp'

export type Profile = {
  id: string
  username: string
  user_code: string
  avatar_url: string | null
  bio: string | null
  team_id: string | null
  advanced_access_enabled: boolean
  standoff_player_id: string | null
  created_at: string
}

export type ProfileWithTeam = Profile & {
  team?: Team | null
}

export type SupportConversationStatus = 'open' | 'pending' | 'closed'

export type SupportConversation = {
  id: string
  user_id: string
  subject: string
  status: SupportConversationStatus
  created_at: string
  updated_at: string
  user?: Profile
}

export type SupportMessage = {
  id: string
  conversation_id: string
  author_id: string
  body: string
  is_admin: boolean
  created_at: string
  author?: Profile
}

export type AdvancedRegistrationRequestStatus = 'pending' | 'approved' | 'rejected'

export type AdvancedRegistrationPayload = {
  standoff_player_id: string
  stats_screenshot_url: string | null
}

export type AdvancedRegistrationRequest = {
  id: string
  user_id: string | null
  email: string
  status: AdvancedRegistrationRequestStatus
  payload: AdvancedRegistrationPayload
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  user?: Profile
  reviewer?: Profile
}

export type Team = {
  id: string
  name: string
  avatar_url: string | null
  creator_id: string
  created_at: string
}

export type DmLobbyMode = 'dm' | 'pistol-dm' | 'rifles-dm' | 'awp-dm' | 'force-dm'

export type DmLobby = {
  id: string
  creator_id: string
  map_id: string
  mode: DmLobbyMode
  headshots_only: boolean
  lobby_link: string
  created_at: string
  expires_at: string
  creator?: Profile
}

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: string
  role_preset: TeamRolePreset | null
  can_add_lineups: boolean
  can_add_strats: boolean
  joined_at: string
  profile?: Profile
}

export type TeamInvite = {
  id: string
  team_id: string
  invitee_user_code: string
  status: string
  created_at: string
  team?: Team
}

export type Lineup = {
  id: string
  team_id: string
  author_id: string
  map: string
  name: string
  description: string | null
  video_url: string | null
  side: 'T' | 'CT'
  throw_stance: string
  throw_movement: string
  throw_jump: boolean
  grenade_type: 'smoke' | 'flash' | 'grenade' | 'molotov'
  anchor_ids: string[]
  screenshots: string[]
  created_at: string
  author?: Profile
}

export type TeamCommentBase = {
  id: string
  team_id: string
  author_id: string
  body: string
  created_at: string
  author?: Profile
}

export type LineupComment = TeamCommentBase & {
  lineup_id: string
}

export type StratComment = TeamCommentBase & {
  strat_id: string
}

export type StratReplayStep = {
  id: string
  title: string
  note: string | null
  scene: SceneState
}

export type StratTrainingChecklistItem = {
  id: string
  title: string
  note: string | null
  role_preset: TeamRolePreset | null
  step_id: string | null
}

export type StratVersionSnapshot = {
  map: string
  name: string
  note: string | null
  video_url: string | null
  side: 'T' | 'CT'
  types: string[]
  anchor_ids: string[]
  replay_steps: StratReplayStep[]
  training_checklist: StratTrainingChecklistItem[]
  linked_lineup_ids: string[]
}

export type StratVersion = {
  id: string
  strat_id: string
  team_id: string
  created_by: string | null
  snapshot: StratVersionSnapshot
  created_at: string
  author?: Profile
}

export type Strat = {
  id: string
  team_id: string
  author_id: string
  map: string
  name: string
  types: string[]
  side: 'T' | 'CT'
  note: string | null
  video_url: string | null
  anchor_ids: string[]
  replay_steps: StratReplayStep[]
  training_checklist: StratTrainingChecklistItem[]
  created_at: string
  author?: Profile
  linked_lineups?: Lineup[]
}

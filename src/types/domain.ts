export type Profile = {
  id: string
  username: string
  user_code: string
  avatar_url: string | null
  bio: string | null
  team_id: string | null
  created_at: string
}

export type ProfileWithTeam = Profile & {
  team?: Team | null
}

export type Team = {
  id: string
  name: string
  avatar_url: string | null
  creator_id: string
  created_at: string
}

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: string
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
  screenshots: string[]
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
  created_at: string
  author?: Profile
}

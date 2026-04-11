import type { TeamRolePreset } from '../types/domain'

export const TEAM_ROLE_PRESETS: Array<{
  value: TeamRolePreset
  label: string
  description: string
}> = [
  {
    value: 'igl',
    label: 'IGL',
    description: 'Calls the round plan and timing.',
  },
  {
    value: 'entry',
    label: 'Entry',
    description: 'Takes first contact and opens space.',
  },
  {
    value: 'support',
    label: 'Support',
    description: 'Sets utility and enables teammates.',
  },
  {
    value: 'lurker',
    label: 'Lurker',
    description: 'Controls rotations and flank timings.',
  },
  {
    value: 'awp',
    label: 'AWP',
    description: 'Holds key angles and long range picks.',
  },
]

export const TEAM_ROLE_PRESET_LABELS = Object.fromEntries(
  TEAM_ROLE_PRESETS.map((preset) => [preset.value, preset.label]),
) as Record<TeamRolePreset, string>

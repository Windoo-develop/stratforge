import type { DmLobbyMode } from '../types/domain'

export const DM_MODES: { id: DmLobbyMode; label: string; description: string }[] = [
  { id: 'dm', label: 'DM', description: 'Classic all-weapon deathmatch.' },
  { id: 'pistol-dm', label: 'Pistol DM', description: 'Warm up only with pistols.' },
  { id: 'rifles-dm', label: 'Rifles DM', description: 'Rifle-only practice lobby.' },
  { id: 'awp-dm', label: 'AWP DM', description: 'Sniper-focused aim session.' },
  { id: 'force-dm', label: 'Force DM', description: 'Force-buy style practice with mixed weapons.' },
]

export function getDmModeLabel(mode: DmLobbyMode) {
  return DM_MODES.find((item) => item.id === mode)?.label ?? mode
}

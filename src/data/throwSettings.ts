export const SIDE_BADGES = {
  T: {
    label: 'T',
    icon: '/assets/editor/badges/t_badge.png',
    className: 'badge-t',
  },
  CT: {
    label: 'CT',
    icon: '/assets/editor/badges/ct_badge.png',
    className: 'badge-ct',
  },
} as const

export const GRENADE_BADGES = {
  smoke: {
    label: 'Smoke',
    icon: '/assets/utilities/vector/smoke.svg',
    className: 'grenade-badge-smoke',
  },
  flash: {
    label: 'Flash',
    icon: '/assets/utilities/vector/flash.svg',
    className: 'grenade-badge-flash',
  },
  grenade: {
    label: 'HE',
    icon: '/assets/utilities/vector/grenade.svg',
    className: 'grenade-badge-grenade',
  },
  molotov: {
    label: 'Molotov',
    icon: '/assets/utilities/vector/molotov.svg',
    className: 'grenade-badge-molotov',
  },
} as const

export const THROW_STANCE_OPTIONS = [
  { value: 'standing', icon: '/assets/editor/system/pose_stand.svg', label: 'Standing' },
  { value: 'crouching', icon: '/assets/editor/system/pose_crouch.svg', label: 'Crouching' },
] as const

export const THROW_MOVEMENT_OPTIONS = [
  { value: 'stationary', icon: '/assets/editor/system/pose_still.svg', label: 'Stationary' },
  { value: 'walking', icon: '/assets/editor/system/pose_walk.svg', label: 'Walking' },
  { value: 'running', icon: '/assets/editor/system/pose_run.svg', label: 'Running' },
] as const

export const THROW_JUMP_OPTIONS = [
  { value: false, icon: '/assets/editor/system/pose_still.svg', label: 'No jump' },
  { value: true, icon: '/assets/editor/system/pose_jump.svg', label: 'Jump throw' },
] as const

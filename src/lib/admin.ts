export const PLATFORM_ADMIN_EMAILS = [
  'aloe230409@gmail.com',
  'oasi050675@gmail.com',
] as const

export function isPlatformAdminEmail(email?: string | null) {
  if (!email) return false
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof PLATFORM_ADMIN_EMAILS)[number])
}

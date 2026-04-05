export function getErrorMessage(error: unknown, fallback = 'Unexpected error') {
  const rawMessage =
    error instanceof Error && error.message
      ? error.message
      : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? ((error as { message?: string }).message ?? '')
        : ''

  if (/infinite recursion detected in policy for relation "team_members"/i.test(rawMessage)) {
    return 'Supabase team membership policies are outdated. Apply 20260405_fix_team_member_rls_recursion.sql in the SQL Editor.'
  }

  if (/database error saving new user/i.test(rawMessage)) {
    return 'Supabase signup trigger failed while creating the profile row. Apply 20260405_registration_trigger_failsafe.sql in the SQL Editor.'
  }

  if (rawMessage.trim()) {
    return rawMessage
  }

  return fallback
}

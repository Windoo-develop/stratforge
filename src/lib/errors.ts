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

  if (/user already registered|email.*already.*registered|email.*already.*taken/i.test(rawMessage)) {
    return 'This email is already taken. Try logging in or use another email.'
  }

  if (/edge function returned a non-2xx status code/i.test(rawMessage)) {
    return 'Email availability check failed. Deploy the Supabase Edge Function check-email-availability and try again.'
  }

  if (/failed to send a request to the edge function/i.test(rawMessage)) {
    return 'Could not reach the email availability check. Verify that the Supabase Edge Function is deployed.'
  }

  if (rawMessage.trim()) {
    return rawMessage
  }

  return fallback
}

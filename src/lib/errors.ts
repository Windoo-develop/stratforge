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

  if (/advanced_registration_requests_player_id_active_unique_idx|profiles_standoff_player_id_unique_idx|standoff_player_id/i.test(rawMessage)) {
    return 'This Standoff 2 ID is already linked to another account or is already waiting for review.'
  }

  if (/advanced_registration_requests_one_pending_per_user_idx|duplicate key value violates unique constraint/i.test(rawMessage)) {
    return 'You already have a pending advanced registration request. Wait for review before submitting another one.'
  }

  if (/review_advanced_registration_request|advanced_access_enabled|advanced-registration-screenshots|is_standoff_player_id_available/i.test(rawMessage)) {
    return 'Advanced registration schema is outdated. Apply 20260411_advanced_registration_flow.sql and 20260411_advanced_identity_and_dm_lobbies.sql in the Supabase SQL Editor.'
  }

  if (/dm_lobbies|has_advanced_access/i.test(rawMessage)) {
    return 'DM schema is outdated. Apply 20260411_advanced_identity_and_dm_lobbies.sql in the Supabase SQL Editor.'
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

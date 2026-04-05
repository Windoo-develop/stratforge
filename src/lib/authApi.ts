import { SITE_URL, supabase } from './supabaseClient'

export type RegisterPayload = {
  email: string
  password: string
  username: string
  bio: string
  avatarUrl: string | null
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/confirm-email`,
    },
  })

  if (error) throw error
}

export async function signUpWithProfile(payload: RegisterPayload) {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      emailRedirectTo: `${SITE_URL}/confirm-email`,
      data: {
        username: payload.username,
        bio: payload.bio,
        avatar_url: payload.avatarUrl,
      },
    },
  })

  if (error) throw error
  return data
}

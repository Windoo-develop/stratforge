/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  ensureProfileForUser,
  finalizePendingProfileDraft,
  resolveProfileForUser,
} from '../lib/profileApi'
import { isPlatformAdminEmail } from '../lib/admin'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types/domain'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const lastHandledSessionRef = useRef<string | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }

    try {
      const nextProfile = await resolveProfileForUser(user)
      setProfile(nextProfile)
    } catch {
      setProfile(null)
    }
  }, [user])

  const applySession = useCallback(async (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null
    setSession(nextSession)
    setUser(nextUser)

    if (!nextUser) {
      setProfile(null)
      return
    }

    await finalizePendingProfileDraft(nextUser)
    const nextProfile = await ensureProfileForUser(nextUser)
    setProfile(nextProfile)
  }, [])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return

      lastHandledSessionRef.current = data.session?.access_token ?? null

      try {
        await applySession(data.session)
      } catch {
        if (active) {
          setProfile(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const accessToken = nextSession?.access_token ?? null
      if (lastHandledSessionRef.current === accessToken) {
        return
      }

      lastHandledSessionRef.current = accessToken

      void (async () => {
        try {
          await applySession(nextSession)
        } catch {
          if (active) {
            setProfile(null)
          }
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      })()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [applySession])

  const value: AuthContextValue = {
    session,
    user,
    profile,
    isAdmin: isPlatformAdminEmail(user?.email),
    loading,
    refreshProfile,
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}

// src/lib/AuthContext.jsx
// ─────────────────────────────────────────────
// Wraps the whole app so any screen can ask
// "who is logged in?" without prop-drilling.
//
// Usage in any component:
//   const { user, profile, loading } = useAuth()
//
// FIX: added retry logic for Google OAuth users whose
// profile row may not exist yet when the callback fires.
// ─────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
        else { setProfile(null); setLoading(false) }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Retries up to 5 times with a short delay between each attempt.
  // This handles Google OAuth users where the profile row is being
  // written by AuthCallbackPage at the same moment this runs —
  // without the retry, the first fetch returns null and the user
  // sees a buyer view even if they registered as a farmer.
  async function fetchProfile(userId, attempt = 1) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data)
      setLoading(false)
    } else if (attempt < 5) {
      // Profile not written yet — wait 600ms and try again
      setTimeout(() => fetchProfile(userId, attempt + 1), 600)
    } else {
      // After 5 attempts, give up and show what we have
      // (user will see correct view on next app open)
      setProfile(null)
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// src/lib/AuthContext.jsx
// ─────────────────────────────────────────────
// Race condition fix:
// If AuthCallbackPage is in the middle of saving a Google profile,
// we wait for it to finish before reading — otherwise we read
// the old buyer row and overwrite the correct role.
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
      if (session?.user) fetchProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          // If AuthCallbackPage is currently saving the profile,
          // wait for it to finish before we try to read
          await waitForCallback()
          fetchProfile(session.user)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // Waits until AuthCallbackPage clears its in-progress flag
  // Polls every 300ms, gives up after 5 seconds
  function waitForCallback() {
    return new Promise((resolve) => {
      const inProgress = sessionStorage.getItem('naagora_callback_in_progress')
      if (!inProgress) { resolve(); return }

      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        const stillInProgress = sessionStorage.getItem('naagora_callback_in_progress')
        if (!stillInProgress || attempts > 16) {
          clearInterval(interval)
          resolve()
        }
      }, 300)
    })
  }

  async function fetchProfile(authUser, attempt = 1) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (data && data.full_name && data.role) {
      setProfile(data)
      setLoading(false)
    } else if (attempt < 4) {
      setTimeout(() => fetchProfile(authUser, attempt + 1), 600)
    } else {
      // Fallback to auth metadata
      const meta = authUser.user_metadata || {}
      const fallbackProfile = {
        id: authUser.id,
        full_name: data?.full_name || meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        role: data?.role || meta.role || 'buyer',
        is_verified: data?.is_verified || false,
        profile_photo: data?.profile_photo || null,
      }
      await supabase.from('users').upsert(fallbackProfile)
      setProfile(fallbackProfile)
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user)
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

// src/pages/AuthCallbackPage.jsx
// ─────────────────────────────────────────────
// Handles Google OAuth redirect back to the app.
//
// KEY FIX: Google OAuth opens a NEW tab/window which has its own
// localStorage — so pendingRole set in the original tab is NOT
// accessible here. We now use sessionStorage as backup, and also
// pass the role as a URL parameter via the state param in OAuth.
//
// Solution: Store role in BOTH localStorage AND a cookie so it
// survives cross-tab redirects.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('Completing sign-in...')

  useEffect(() => {
    async function handleCallback() {
      // Check for OAuth errors first
      const params = new URLSearchParams(location.search)
      const error = params.get('error')

      if (error) {
        const message = error === 'bad_oauth_state'
          ? 'Sign-in session expired. Please try again.'
          : params.get('error_description')?.replace(/\+/g, ' ') || 'Sign-in failed. Please try again.'
        toast.error(message)
        navigate('/login')
        return
      }

      setStatus('Getting your account...')

      // Wait for Supabase to process the OAuth tokens from URL hash
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast.error('Could not complete sign-in. Please try again.')
        navigate('/login')
        return
      }

      const user = session.user
      setStatus('Setting up your profile...')

      // Check if profile already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single()

      if (existing?.full_name && existing?.role && existing.role !== 'buyer') {
        // Returning user with complete profile — just go home
        toast.success('Welcome back!')
        navigate('/')
        return
      }

      // New Google user OR returning user whose role was saved as buyer incorrectly
      // Try every possible way to get the intended role:

      // Method 1: Cookie (most reliable across tabs)
      const cookieRole = getCookie('naagora_pending_role')

      // Method 2: localStorage (works if same tab)
      const localRole = localStorage.getItem('pendingRole')

      // Method 3: sessionStorage (same tab, survives redirects)
      const sessionRole = sessionStorage.getItem('pendingRole')

      // Method 4: URL search params (if we passed it)
      const urlRole = params.get('role')

      // Use whichever we find, priority order
      const role = cookieRole || localRole || sessionRole || urlRole || existing?.role || 'buyer'

      // Clean up all storage methods
      deleteCookie('naagora_pending_role')
      localStorage.removeItem('pendingRole')
      sessionStorage.removeItem('pendingRole')

      // Save/update the profile with correct role
      const profileData = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
        email: user.email,
        role,
      }

      const { error: profileError } = await supabase
        .from('users')
        .upsert(profileData)

      if (profileError) {
        console.error('Profile save error:', profileError)
      }

      // Create wallet if needed
      if (role === 'farmer' || role === 'provider') {
        await supabase.from('wallets').upsert({ user_id: user.id, balance: 0 })
      }

      toast.success(existing ? 'Welcome back!' : 'Welcome to Naagora!')
      navigate('/')
    }

    handleCallback()
  }, [navigate, location])

  return (
    <div style={{
      height: '100dvh', display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>{status}</p>
    </div>
  )
}

// Cookie helpers — cookies survive cross-tab and cross-window navigation
function setCookie(name, value, minutes = 10) {
  const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}

// Export setCookie so RegisterPage can use it
export { setCookie }

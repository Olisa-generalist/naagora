// src/pages/AuthCallbackPage.jsx
// Handles Google OAuth redirect back to the app.
// Also catches error states from Supabase OAuth flow.

import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    async function handleCallback() {
      // Check for OAuth errors in the URL first
      const params = new URLSearchParams(location.search)
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      if (error) {
        // OAuth state errors usually mean the user took too long
        // or opened in a different browser tab — just send them back to login
        const message = error === 'bad_oauth_state'
          ? 'Sign-in session expired. Please try again.'
          : errorDescription?.replace(/\+/g, ' ') || 'Sign-in failed. Please try again.'
        toast.error(message)
        navigate('/login')
        return
      }

      // No error — try to get the session Supabase set via the URL hash
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast.error('Could not complete sign-in. Please try again.')
        navigate('/login')
        return
      }

      const user = session.user

      // Check if this is a new user (no profile row yet)
      const { data: existing } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (!existing) {
        // New Google user — save their profile
        const role = localStorage.getItem('pendingRole') || 'buyer'
        localStorage.removeItem('pendingRole')

        await supabase.from('users').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          email: user.email,
          role,
        })

        if (role === 'farmer' || role === 'provider') {
          await supabase.from('wallets').upsert({ user_id: user.id, balance: 0 })
        }

        toast.success('Welcome to Naagora!')
      } else {
        toast.success('Welcome back!')
      }

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
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Signing you in...</p>
    </div>
  )
}

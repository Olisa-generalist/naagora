// src/pages/AuthCallbackPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('Completing sign-in...')

  useEffect(() => {
    handleCallback()
  }, [])

  async function handleCallback() {
    const params = new URLSearchParams(location.search)
    const error = params.get('error')

    if (error) {
      toast.error(error === 'bad_oauth_state'
        ? 'Sign-in session expired. Please try again.'
        : 'Sign-in failed. Please try again.')
      navigate('/login')
      return
    }

    setStatus('Getting your account...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      toast.error('Could not complete sign-in. Please try again.')
      navigate('/login')
      return
    }

    const user = session.user
    setStatus('Setting up your profile...')

    // ── STEP 1: Try to get role from pending_roles table (most reliable) ──
    let intendedRole = null
    const roleToken = params.get('role_token')

    if (roleToken) {
      const { data: pending } = await supabase
        .from('pending_roles')
        .select('role')
        .eq('token', roleToken)
        .single()

      if (pending?.role) {
        intendedRole = pending.role
        // Clean up the used token
        await supabase.from('pending_roles').delete().eq('token', roleToken)
      }
    }

    // ── STEP 2: Fall back to cookie/localStorage if no DB token ──
    if (!intendedRole) {
      intendedRole = getCookie('nr')
        || localStorage.getItem('pendingRole')
        || sessionStorage.getItem('pendingRole')
    }

    // Clean up
    deleteCookie('nr')
    localStorage.removeItem('pendingRole')
    sessionStorage.removeItem('pendingRole')

    // ── STEP 3: Check existing profile ──
    const { data: existing } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    // ── STEP 4: Determine final role ──
    // Priority: DB token > cookie > existing non-buyer role > default buyer
    let finalRole = 'buyer'
    if (intendedRole && intendedRole !== 'buyer') {
      finalRole = intendedRole
    } else if (existing?.role && existing.role !== 'buyer') {
      finalRole = existing.role // keep existing role for returning users
    } else if (intendedRole === 'buyer') {
      finalRole = 'buyer'
    }

    // ── STEP 5: Save/update profile ──
    await supabase.from('users').upsert({
      id: user.id,
      full_name: existing?.full_name
        || user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.email?.split('@')[0],
      email: user.email,
      role: finalRole,
    })

    // Create wallet for earning roles
    if (finalRole === 'farmer' || finalRole === 'provider') {
      await supabase.from('wallets').upsert({ user_id: user.id, balance: 0 })
    }

    toast.success(existing?.full_name ? 'Welcome back!' : `Welcome to Naagora! Signed in as ${finalRole}.`)
    navigate('/')
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>{status}</p>
    </div>
  )
}

export function setCookie(name, value, minutes = 10) {
  const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

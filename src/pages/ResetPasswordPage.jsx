// src/pages/ResetPasswordPage.jsx
// ─────────────────────────────────────────────
// Supabase sends users here with a token in the URL
// like: /reset-password#access_token=xxx&type=recovery
// We must exchange that token for a session FIRST,
// then allow the password update.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false) // true once session is established

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash.
    // onAuthStateChange fires with event 'PASSWORD_RECOVERY'
    // which automatically exchanges the token for a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Session is now active — safe to update password
          setReady(true)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated! Please sign in with your new password.')
      await supabase.auth.signOut()
      navigate('/login')
    }
    setLoading(false)
  }

  // Still waiting for Supabase to exchange the token
  if (!ready) {
    return (
      <div className="auth-page" style={{ alignItems: 'center' }}>
        <div className="auth-logo">Naagora</div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" />
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Verifying your reset link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">Naagora</div>
      <p className="auth-tagline">Set a new password</p>

      <form onSubmit={handleReset}>
        <div className="input-group">
          <label>New password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingRight: 44 }}
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', padding: 0,
                display: 'flex', alignItems: 'center'
              }}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>Confirm new password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Type it again"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </div>

        {/* Live match indicator */}
        {confirm.length > 0 && (
          <p style={{
            fontSize: 12, marginBottom: 12,
            color: password === confirm ? 'var(--green)' : 'var(--red)'
          }}>
            {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
          </p>
        )}

        <button className="btn btn-primary btn-full" disabled={loading}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

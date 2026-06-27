// src/pages/RegisterPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const ROLES = [
  { id: 'buyer',    icon: '🛒', title: 'Buyer',    desc: 'Buy farm produce' },
  { id: 'farmer',   icon: '🌾', title: 'Farmer',   desc: 'Sell your produce' },
  { id: 'provider', icon: '🚚', title: 'Logistics', desc: 'Offer delivery services' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.role) return
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)

    // Step 1: create the Supabase auth account
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, role: form.role }
      }
    })
    if (error) { toast.error(error.message); setLoading(false); return }

    // Step 2: save their profile row in our users table
    const { error: profileError } = await supabase.from('users').upsert({
      id: data.user.id,
      full_name: form.name,
      email: form.email,
      role: form.role,
    })
    if (profileError) {
      toast.error('Account created but profile save failed. Please contact support.')
    }

    // Step 3: create wallet for farmers and logistics providers
    if (form.role === 'farmer' || form.role === 'provider') {
      await supabase.from('wallets').upsert({ user_id: data.user.id, balance: 0 })
    }

    toast.success('Account created! Welcome to Naagora.')
    navigate('/')
    setLoading(false)
  }

  // Google sign-up — role gets collected after they authenticate
  // We store it via a follow-up screen (for now, defaults to 'buyer')
  async function handleGoogleSignup() {
    setGoogleLoading(true)

    // Save their chosen role to localStorage so we can use it after redirect
    localStorage.setItem('pendingRole', form.role)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://naagora.vercel.app/auth/callback'
      }
    })
    if (error) {
      toast.error('Google sign-up failed. Try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">Naagora</div>
      <p className="auth-tagline">Create your account</p>

      {/* Role selection — shown for both Google and email signup */}
      <div className="section-label" style={{ marginTop: 0, marginBottom: 10 }}>I am a</div>
      <div className="role-cards" style={{ marginBottom: 16 }}>
        {ROLES.map(r => (
          <div
            key={r.id}
            className={`role-card ${form.role === r.id ? 'selected' : ''}`}
            onClick={() => setForm(f => ({ ...f, role: r.id }))}
          >
            <div className="role-card-icon">{r.icon}</div>
            <div className="role-card-title">{r.title}</div>
            <div className="role-card-desc">{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Google sign-up */}
      <button
        className="btn btn-full"
        onClick={handleGoogleSignup}
        disabled={googleLoading}
        style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        <GoogleIcon />
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>

      <div className="auth-divider">or register with email</div>

      {/* Email + password registration */}
      <form onSubmit={handleRegister}>
        <div className="input-group">
          <label>Full name</label>
          <input
            placeholder="Your full name"
            value={form.name}
            onChange={set('name')}
            required
          />
        </div>
        <div className="input-group">
          <label>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set('email')}
            required
          />
        </div>
        <div className="input-group">
          <label>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={set('password')}
              style={{ paddingRight: 44 }}
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
              {showPassword
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
        </div>

        <button className="btn btn-primary btn-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="auth-divider">Already have an account?</div>
      <Link to="/login" className="btn btn-full" style={{ textAlign: 'center' }}>
        Sign in
      </Link>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

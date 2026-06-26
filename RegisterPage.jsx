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
  const [step, setStep] = useState('details')  // 'details' | 'otp'
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', role: 'buyer' })

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('0')) return '+234' + digits.slice(1)
    if (digits.startsWith('234')) return '+' + digits
    return '+' + digits
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function sendOTP(e) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.role) return
    setLoading(true)
    const formatted = formatPhone(form.phone)
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
      options: {
        // Pass name and role through so we can save them after OTP verify
        data: { full_name: form.name, role: form.role }
      }
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Code sent to ' + formatted)
    setStep('otp')
    setLoading(false)
  }

  async function verifyAndCreate(e) {
    e.preventDefault()
    setLoading(true)
    const formatted = formatPhone(form.phone)

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted, token: otp, type: 'sms'
    })
    if (error) { toast.error('Wrong code. Try again.'); setLoading(false); return }

    // Create their profile row in our users table
    const { error: profileError } = await supabase.from('users').upsert({
      id: data.user.id,
      full_name: form.name,
      phone: formatted,
      role: form.role,
    })
    if (profileError) { toast.error('Account created but profile save failed. Contact support.'); }

    // Create a wallet for farmers and providers (they get paid)
    if (form.role === 'farmer' || form.role === 'provider') {
      await supabase.from('wallets').upsert({ user_id: data.user.id, balance: 0 })
    }

    toast.success('Welcome to FarmLink!')
    navigate('/')
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">FarmLink</div>
      <p className="auth-tagline">Create your account</p>

      {step === 'details' ? (
        <form onSubmit={sendOTP}>
          <div className="input-group">
            <label>Full name</label>
            <input placeholder="Olisa Nnadi" value={form.name} onChange={set('name')} required />
          </div>
          <div className="input-group">
            <label>Phone number</label>
            <input type="tel" placeholder="08012345678" value={form.phone} onChange={set('phone')} required />
          </div>

          <div className="section-label" style={{ marginTop: 8 }}>I am a</div>
          <div className="role-cards">
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

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Sending code...' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyAndCreate}>
          <p style={{ marginBottom: 16, fontSize: 14 }}>
            Enter the 6-digit code sent to <strong>{form.phone}</strong>
          </p>
          <div className="input-group">
            <label>Verification code</label>
            <input
              type="number" placeholder="123456"
              value={otp} onChange={e => setOtp(e.target.value)}
              maxLength={6} autoFocus required
            />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <button type="button" className="btn btn-full" style={{ marginTop: 8 }}
            onClick={() => setStep('details')}>
            Go back
          </button>
        </form>
      )}

      <div className="auth-divider">Already have an account?</div>
      <Link to="/login" className="btn btn-full" style={{ textAlign: 'center' }}>Sign in</Link>
    </div>
  )
}

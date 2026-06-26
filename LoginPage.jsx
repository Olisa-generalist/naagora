// src/pages/LoginPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [loading, setLoading] = useState(false)

  // Format phone to international — Nigeria numbers start 08x → +2348x
  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('0')) return '+234' + digits.slice(1)
    if (digits.startsWith('234')) return '+' + digits
    return '+' + digits
  }

  async function sendOTP(e) {
    e.preventDefault()
    if (!phone) return
    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('OTP sent to ' + formatted)
      setStep('otp')
    }
    setLoading(false)
  }

  async function verifyOTP(e) {
    e.preventDefault()
    if (!otp) return
    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms'
    })
    if (error) {
      toast.error('Wrong code. Try again.')
    } else {
      toast.success('Welcome back!')
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">FarmLink</div>
      <p className="auth-tagline">Nigeria's farm-to-buyer marketplace</p>

      {step === 'phone' ? (
        <form onSubmit={sendOTP}>
          <div className="input-group">
            <label>Phone number</label>
            <input
              type="tel"
              placeholder="08012345678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOTP}>
          <p style={{ marginBottom: 16, fontSize: 14 }}>
            Enter the 6-digit code sent to <strong>{phone}</strong>
          </p>
          <div className="input-group">
            <label>Verification code</label>
            <input
              type="number"
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Confirm code'}
          </button>
          <button
            type="button"
            className="btn btn-full"
            style={{ marginTop: 8 }}
            onClick={() => setStep('phone')}
          >
            Use a different number
          </button>
        </form>
      )}

      <div className="auth-divider">Don't have an account?</div>
      <Link to="/register" className="btn btn-full" style={{ textAlign: 'center' }}>
        Create account
      </Link>
    </div>
  )
}

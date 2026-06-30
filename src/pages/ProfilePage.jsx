// src/pages/ProfilePage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProfilePhotoUpload from '../components/ProfilePhotoUpload'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address || '')
  const [loading, setLoading] = useState(false)

  const role = profile?.role || 'buyer'

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('users').update({
        full_name: name.trim(),
        phone: phone.trim(),
        business_address: businessAddress.trim() || null,
      }).eq('id', profile.id)
    if (error) { toast.error('Could not update profile') }
    else { toast.success('Profile updated!'); await refreshProfile(); setEditing(false) }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="topbar"><h1>My Profile</h1></div>

      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* Avatar section — shows role-specific icons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>

          {/* Profile photo upload — works for all roles */}
          <ProfilePhotoUpload currentPhoto={profile?.profile_photo} />
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, marginBottom: 6 }}>Tap photo to update</p>

          {/* Role icons below photo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, marginTop: 4 }}>
            {role === 'farmer' && <>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌾</div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛒</div>
            </>}
            {role === 'provider' && <>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚚</div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛒</div>
            </>}
            {role === 'buyer' && <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛒</div>}
            {role === 'admin' && <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛡️</div>}
          </div>

          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>
            {profile?.full_name || 'Loading...'}
          </div>

          {/* Role badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {role === 'farmer' && <>
              <span style={{ background: '#E1F5EE', color: '#085041', fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🌾 Farmer</span>
              <span style={{ background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🛒 Buyer</span>
            </>}
            {role === 'provider' && <>
              <span style={{ background: '#FAEEDA', color: '#633806', fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🚚 Logistics Provider</span>
              <span style={{ background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🛒 Buyer</span>
            </>}
            {role === 'buyer' && <span style={{ background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🛒 Buyer</span>}
            {role === 'admin' && <span style={{ background: '#F1EFE8', color: '#444441', fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🛡️ Admin</span>}
          </div>
        </div>

        {/* Account details */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Account details</div>

            {editing ? (
              <form onSubmit={handleSaveName}>
                <div className="input-group">
                  <label>Full name</label>
                  <input value={name} onChange={e => setName(e.target.value)} autoFocus required />
                </div>
                <div className="input-group">
                  <label>Phone number</label>
                  <input type="tel" placeholder="08012345678" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                {(role === 'farmer' || role === 'provider') && (
                  <div className="input-group">
                    <label>{role === 'farmer' ? 'Farm pickup address' : 'Business / base address'}</label>
                    <textarea
                      placeholder={role === 'farmer'
                        ? 'Full address where logistics can pick up your produce'
                        : 'Your base address (for reference only)'}
                      value={businessAddress}
                      onChange={e => setBusinessAddress(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '0.5px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Full name</div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{profile?.full_name}</div>
                </div>
                <button className="btn btn-sm" onClick={() => { setName(profile?.full_name || ''); setEditing(true) }}>Edit</button>
              </div>
            )}

            <div style={{ paddingTop: 10, paddingBottom: 10, borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Email</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{profile?.email || 'Not set'}</div>
            </div>
            <div style={{ paddingTop: 10, paddingBottom: (role === 'farmer' || role === 'provider') ? 10 : 0, borderBottom: (role === 'farmer' || role === 'provider') ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Phone number</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>
                {profile?.phone || <span style={{ color: 'var(--red)' }}>Not set — add this so buyers/farmers/providers can reach you</span>}
              </div>
            </div>
            {(role === 'farmer' || role === 'provider') && (
              <div style={{ paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {role === 'farmer' ? 'Farm pickup address' : 'Business address'}
                </div>
                <div style={{ fontSize: 14, marginTop: 2 }}>
                  {profile?.business_address || <span style={{ color: 'var(--red)' }}>Not set — add this so logistics providers know where to collect from</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Farmer quick links */}
        {role === 'farmer' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Farmer tools</div>
              {[
                { to: '/dashboard', icon: '📊', label: 'My dashboard & orders' },
                { to: '/add-product', icon: '➕', label: 'Add new product' },
                { to: '/', icon: '🛒', label: 'Browse marketplace as buyer' },
              ].map((item, i, arr) => (
                <Link key={item.to + item.label} to={item.to} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '9px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 14 }}>{item.icon} {item.label}</span>
                  <span style={{ color: 'var(--text-3)' }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Logistics provider quick links */}
        {role === 'provider' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Logistics tools</div>
              {[
                { to: '/dashboard', icon: '📊', label: 'My dashboard & jobs' },
                { to: '/add-service', icon: '➕', label: 'Add new service' },
                { to: '/', icon: '🛒', label: 'Browse marketplace as buyer' },
              ].map((item, i, arr) => (
                <Link key={item.to + item.label} to={item.to} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '9px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 14 }}>{item.icon} {item.label}</span>
                  <span style={{ color: 'var(--text-3)' }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Buyer quick links */}
        {role === 'buyer' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Buyer tools</div>
              {[
                { to: '/orders', icon: '📦', label: 'My orders' },
                { to: '/', icon: '🛒', label: 'Browse marketplace' },
              ].map((item, i, arr) => (
                <Link key={item.to} to={item.to} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '9px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 14 }}>{item.icon} {item.label}</span>
                  <span style={{ color: 'var(--text-3)' }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Admin panel link */}
        {role === 'admin' && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <Link to="/admin" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '4px 0' }}>
                <span style={{ fontSize: 14 }}>🛡️ Admin panel</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </Link>
            </div>
          </div>
        )}

        {/* Role explanation for farmer and provider */}
        {(role === 'farmer' || role === 'provider') && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 12 }}>
            💡 Your account has two roles — {role === 'farmer' ? 'Farmer and Buyer' : 'Logistics Provider and Buyer'}. You can use the marketplace to buy produce just like any buyer.
          </div>
        )}

        <button className="btn btn-full" onClick={signOut} style={{ color: 'var(--red)', borderColor: 'var(--red-light)' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}

import { useAuth } from '../lib/AuthContext'
export default function ProfilePage() {
  const { profile, signOut } = useAuth()
  return (
    <div className="page">
      <div className="topbar"><h1>Profile</h1></div>
      <div className="page-content" style={{paddingTop:24}}>
        <p style={{marginBottom:8}}><strong>{profile?.full_name}</strong></p>
        <p style={{marginBottom:24}}>{profile?.phone} · {profile?.role}</p>
        <button className="btn btn-full" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}

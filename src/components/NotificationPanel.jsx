// src/components/NotificationPanel.jsx
// Bell icon sits in the top-right corner of every screen's topbar.
// Dropdown panel opens below it.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TYPE_ICONS = {
  order_paid: '💰',
  order_confirmed: '✅',
  order_in_progress: '🚚',
  order_completed: '📦',
  payment_released: '🎉',
  product_approved: '✅',
  product_rejected: '❌',
  default: '🔔',
}

export default function NotificationPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchNotifications()

    const channel = supabase
      .channel('notifications_' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => fetchNotifications())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications(data || [])
    setUnreadCount((data || []).filter(n => !n.is_read).length)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    fetchNotifications()
  }

  async function handleNotificationClick(notif) {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      fetchNotifications()
    }
    if (notif.order_id) {
      setOpen(false)
      navigate(`/orders/${notif.order_id}`)
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <>
      {/* Bell button — fixed top-right corner, above everything */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        style={{
          position: 'fixed', top: 14, right: 16, zIndex: 50,
          width: 38, height: 38, borderRadius: '50%',
          background: '#fff', border: '0.5px solid var(--border, rgba(0,0,0,0.12))',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 17, height: 17, borderRadius: 9,
            background: '#D85A30', color: '#fff',
            fontSize: 9, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff', padding: '0 4px'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />

          <div style={{
            position: 'fixed', top: 58, right: 16, zIndex: 51,
            width: 320, maxWidth: 'calc(100vw - 32px)',
            background: '#fff', borderRadius: 14,
            border: '0.5px solid var(--border, rgba(0,0,0,0.1))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            maxHeight: '70vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '14px 16px 10px', borderBottom: '0.5px solid var(--border, rgba(0,0,0,0.1))',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Notifications</div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--green, #0F6E56)', fontFamily: 'inherit'
                }}>
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3, #888)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                  <div style={{ fontSize: 13 }}>No notifications yet</div>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '0.5px solid var(--border, rgba(0,0,0,0.06))',
                      background: notif.is_read ? 'transparent' : 'rgba(15,110,86,0.04)',
                      display: 'flex', gap: 10
                    }}
                  >
                    <div style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICONS[notif.type] || TYPE_ICONS.default}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: notif.is_read ? 400 : 600, fontSize: 13 }}>{notif.title}</div>
                        {!notif.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0F6E56', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2, #5f5e5a)', marginTop: 2, lineHeight: 1.4 }}>{notif.body}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3, #888)', marginTop: 4 }}>{timeAgo(notif.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

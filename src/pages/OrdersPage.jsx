// src/pages/OrdersPage.jsx
// Lists all buyer orders with status
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STATUS_BADGE = {
  pending:     { label: 'Pending payment', cls: 'badge-gray' },
  paid:        { label: 'Paid — escrow held', cls: 'badge-amber' },
  in_progress: { label: 'On the way', cls: 'badge-green' },
  completed:   { label: 'Completed', cls: 'badge-green' },
  disputed:    { label: 'Disputed', cls: 'badge-red' },
  refunded:    { label: 'Refunded', cls: 'badge-red' },
  cancelled:   { label: 'Cancelled', cls: 'badge-gray' },
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) fetchOrders() }, [user])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, total_amount, created_at, order_type,
        order_legs (
          leg_type, status, products ( name, photos ),
          logistics_services ( name )
        )
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const productLeg = (order) => order.order_legs?.find(l => l.leg_type === 'product')
  const photo = (order) => productLeg(order)?.products?.photos?.[0]

  return (
    <div className="page">
      <div className="topbar"><h1>My orders</h1></div>
      <div className="page-content" style={{ paddingTop: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🛒</div>
            <h3>No orders yet</h3>
            <p>Browse the marketplace and place your first order.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 8 }}>Browse marketplace</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(order => {
              const badge = STATUS_BADGE[order.status] || STATUS_BADGE.pending
              const pLeg = productLeg(order)
              const thumb = photo(order)
              const refId = `#NAG-${order.id.substring(0, 8).toUpperCase()}`
              return (
                <Link key={order.id} to={`/orders/${order.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card" style={{ transition: 'border-color 0.15s' }}>
                    <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {thumb
                          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : '📦'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>
                            {pLeg?.products?.name || 'Order'}
                          </div>
                          <span className={`badge ${badge.cls}`} style={{ flexShrink: 0, marginLeft: 8 }}>
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                          {refId} · {new Date(order.created_at).toLocaleDateString('en-NG')}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginTop: 4 }}>
                          ₦{Number(order.total_amount).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-3)', fontSize: 16 }}>→</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

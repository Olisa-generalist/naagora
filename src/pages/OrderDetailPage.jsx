// src/pages/OrderDetailPage.jsx
// Shows full order status with per-leg tracking
// Buyer can confirm delivery from here
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const LEG_STATUS_STEPS = ['pending', 'paid_held', 'confirmed', 'in_progress', 'completed']

const STATUS_INFO = {
  pending:     { label: 'Awaiting payment', color: 'var(--text-3)',   bg: '#F1EFE8' },
  paid_held:   { label: 'Payment held in escrow', color: '#633806',  bg: '#FAEEDA' },
  confirmed:   { label: 'Confirmed by provider', color: '#085041',   bg: '#E1F5EE' },
  in_progress: { label: 'On the way',         color: '#085041',      bg: '#E1F5EE' },
  completed:   { label: 'Delivered ✓',        color: '#27500A',      bg: '#EAF3DE' },
  disputed:    { label: 'Disputed',           color: '#791F1F',      bg: '#FCEBEB' },
  refunded:    { label: 'Refunded',           color: '#791F1F',      bg: '#FCEBEB' },
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [order, setOrder] = useState(null)
  const [legs, setLegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null) // legId being confirmed

  useEffect(() => { fetchOrder() }, [id])

  async function fetchOrder() {
    setLoading(true)
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    const { data: legsData } = await supabase
      .from('order_legs')
      .select(`
        *, 
        products ( name, unit, photos ),
        logistics_services ( name, vehicle_type ),
        users!order_legs_provider_id_fkey ( full_name, phone )
      `)
      .eq('order_id', id)
      .order('leg_type')

    setOrder(orderData)
    setLegs(legsData || [])
    setLoading(false)
  }

  async function confirmDelivery(legId) {
    setConfirming(legId)
    try {
      const leg = legs.find(l => l.id === legId)

      // Mark leg as completed
      await supabase
        .from('order_legs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), payout_released: true, payout_released_at: new Date().toISOString() })
        .eq('id', legId)

      // Credit provider wallet
      await supabase.rpc('credit_wallet', {
        p_user_id: leg.provider_id,
        p_amount: leg.leg_payout
      }).catch(async () => {
        // Fallback if RPC doesn't exist — direct update
        const { data: wallet } = await supabase
          .from('wallets').select('balance, total_earned').eq('user_id', leg.provider_id).single()
        if (wallet) {
          await supabase.from('wallets').update({
            balance: Number(wallet.balance) + Number(leg.leg_payout),
            total_earned: Number(wallet.total_earned) + Number(leg.leg_payout),
            updated_at: new Date().toISOString()
          }).eq('user_id', leg.provider_id)
        }
      })

      // Check if all legs completed → mark order complete
      const updatedLegs = legs.map(l => l.id === legId ? { ...l, status: 'completed' } : l)
      const allDone = updatedLegs.every(l => l.status === 'completed')
      if (allDone) {
        await supabase.from('orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id)
        await supabase.from('payments').update({ status: 'released', released_at: new Date().toISOString() }).eq('order_id', id)
      }

      toast.success('Delivery confirmed! Payment released to provider.')
      fetchOrder()
    } catch (err) {
      toast.error('Could not confirm delivery. Try again.')
    }
    setConfirming(null)
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  if (!order) return (
    <div className="page"><div className="page-content"><div className="empty"><h3>Order not found</h3></div></div></div>
  )

  const isBuyer = profile?.role === 'buyer' || order.buyer_id === user?.id
  const refId = `#NAG-${order.id.substring(0, 8).toUpperCase()}`

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate('/orders')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 15 }}>Order {refId}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
            {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 16 }}>

        {/* Order summary */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Order total</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>
                ₦{Number(order.total_amount).toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)' }}>Delivery to</span>
              <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{order.delivery_address}, {order.delivery_state}</span>
            </div>
          </div>
        </div>

        {/* Each leg */}
        {legs.map(leg => {
          const info = STATUS_INFO[leg.status] || STATUS_INFO.pending
          const stepIndex = LEG_STATUS_STEPS.indexOf(leg.status)
          const isProductLeg = leg.leg_type === 'product'
          const canConfirm = isBuyer && leg.status === 'in_progress'

          return (
            <div key={leg.id} className="card" style={{ marginBottom: 12 }}>
              <div className="card-body">
                {/* Leg header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {isProductLeg
                        ? (leg.products?.name || 'Product')
                        : (leg.logistics_services?.name || 'Logistics')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {isProductLeg
                        ? `${leg.quantity} ${leg.products?.unit} · ${leg.users?.full_name}`
                        : `${leg.logistics_services?.vehicle_type?.replace(/_/g, ' ')} · ${leg.users?.full_name}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: info.bg, color: info.color, flexShrink: 0, marginLeft: 8 }}>
                    {info.label}
                  </span>
                </div>

                {/* Progress timeline */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  {['Paid', 'Confirmed', 'In transit', 'Delivered'].map((step, i) => {
                    const done = stepIndex > i
                    const active = stepIndex === i + 1
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: done || active ? 'var(--green)' : 'var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, color: '#fff'
                          }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap' }}>{step}</div>
                        </div>
                        {i < 3 && (
                          <div style={{ flex: 1, height: 2, background: done ? 'var(--green)' : 'var(--border)', margin: '0 2px', marginBottom: 12 }} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Payout info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: leg.status === 'completed' || canConfirm ? 10 : 0 }}>
                  <span>{isProductLeg ? 'Farmer receives' : 'Provider receives'}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>₦{Number(leg.leg_payout).toLocaleString()}</span>
                </div>

                {/* Completed */}
                {leg.status === 'completed' && (
                  <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#27500A', textAlign: 'center' }}>
                    ✓ Payment of ₦{Number(leg.leg_payout).toLocaleString()} released to provider
                  </div>
                )}

                {/* Confirm delivery button */}
                {canConfirm && (
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => confirmDelivery(leg.id)}
                    disabled={confirming === leg.id}
                    style={{ marginTop: 4 }}
                  >
                    {confirming === leg.id ? 'Confirming...' : `Confirm ${isProductLeg ? 'goods received' : 'delivery done'}`}
                  </button>
                )}

                {/* Dispute link */}
                {isBuyer && ['paid_held', 'confirmed', 'in_progress'].includes(leg.status) && (
                  <Link
                    to={`/dispute/${order.id}/${leg.id}`}
                    style={{ display: 'block', textAlign: 'center', fontSize: 12, color: 'var(--red)', marginTop: 8, textDecoration: 'none' }}
                  >
                    Raise a dispute
                  </Link>
                )}
              </div>
            </div>
          )
        })}

        {/* Review prompt — shown when order is fully completed */}
        {order.status === 'completed' && isBuyer && (
          <div style={{ background: 'var(--green-light)', borderRadius: 12, padding: '14px 16px', marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>⭐</div>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>How was your experience?</div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              Leave a review to help other buyers
            </p>
            <Link to={`/review/${order.id}`} className="btn btn-primary btn-sm" style={{ display: 'inline-block' }}>
              Leave a review
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// src/pages/OrderDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { notifyPayoutReleased, notifyBuyerOfLegUpdate } from '../lib/notifications'
import ContactCard from '../components/ContactCard'
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
  const [confirming, setConfirming] = useState(null)

  useEffect(() => { fetchOrder() }, [id])

  async function fetchOrder() {
    setLoading(true)

    // STEP 1: Get the order itself
    const { data: orderData } = await supabase.from('orders').select('*').eq('id', id).single()

    // STEP 2: Get raw legs — no nested joins, same pattern as the
    // dashboards. Nested joins through multiple foreign keys can
    // silently return null for the joined data even when RLS allows
    // the underlying rows, so we fetch and stitch manually.
    const { data: rawLegs, error: legsError } = await supabase
      .from('order_legs')
      .select('*')
      .eq('order_id', id)
      .order('leg_type')

    if (legsError) console.error('Fetch legs error:', legsError)

    let enrichedLegs = []
    if (rawLegs && rawLegs.length > 0) {
      // STEP 3: Fetch products for product legs
      const productIds = [...new Set(rawLegs.map(l => l.product_id).filter(Boolean))]
      const { data: products } = productIds.length
        ? await supabase.from('products').select('id, name, unit, photos').in('id', productIds)
        : { data: [] }

      // STEP 4: Fetch logistics services for logistics legs
      const serviceIds = [...new Set(rawLegs.map(l => l.logistics_service_id).filter(Boolean))]
      const { data: services } = serviceIds.length
        ? await supabase.from('logistics_services').select('id, name, vehicle_type, photos').in('id', serviceIds)
        : { data: [] }

      // STEP 5: Fetch provider (farmer or 3PL) contact info for every leg
      const providerIds = [...new Set(rawLegs.map(l => l.provider_id).filter(Boolean))]
      const { data: providers, error: providersError } = providerIds.length
        ? await supabase.from('users').select('id, full_name, phone, profile_photo').in('id', providerIds)
        : { data: [] }

      if (providersError) console.error('Fetch providers error:', providersError)

      // STEP 6: Stitch it all together
      enrichedLegs = rawLegs.map(leg => {
        const product = products?.find(p => p.id === leg.product_id)
        const service = services?.find(s => s.id === leg.logistics_service_id)
        const provider = providers?.find(p => p.id === leg.provider_id)
        return {
          ...leg,
          products: product || null,
          logistics_services: service || null,
          provider: provider || null,
        }
      })
    }

    // STEP 7: Buyer info (for provider view)
    let buyerInfo = null
    if (orderData) {
      const { data: buyer } = await supabase
        .from('users').select('id, full_name, phone').eq('id', orderData.buyer_id).single()
      buyerInfo = buyer
    }

    setOrder(orderData ? { ...orderData, buyerInfo } : orderData)
    setLegs(enrichedLegs)
    setLoading(false)
  }

  async function confirmDelivery(legId) {
    setConfirming(legId)
    try {
      const leg = legs.find(l => l.id === legId)

      const { error: legError } = await supabase
        .from('order_legs')
        .update({
          status: 'completed', completed_at: new Date().toISOString(),
          payout_released: true, payout_released_at: new Date().toISOString()
        })
        .eq('id', legId)
      if (legError) throw new Error('Could not update order leg: ' + legError.message)

      const { error: walletError } = await supabase.rpc('credit_wallet', {
        p_user_id: leg.provider_id,
        p_amount: Number(leg.leg_payout)
      })
      if (walletError) {
        console.error('Wallet credit error:', walletError)
        toast.error('Payment release had an issue — contact Naagora support with order ' + id)
      } else {
        await notifyPayoutReleased(leg.provider_id, leg.leg_payout)
      }

      await notifyBuyerOfLegUpdate(id, leg.leg_type, 'completed')

      const updatedLegs = legs.map(l => l.id === legId ? { ...l, status: 'completed' } : l)
      const allDone = updatedLegs.every(l => l.status === 'completed')
      if (allDone) {
        await supabase.from('orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id)
        await supabase.from('payments').update({ status: 'released', released_at: new Date().toISOString() }).eq('order_id', id)
      }

      toast.success('Delivery confirmed! Payment released to provider.')
      fetchOrder()
    } catch (err) {
      console.error('Confirm delivery error:', err)
      toast.error('Could not confirm delivery: ' + (err.message || 'Unknown error'))
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

  const viewerRole = profile?.role || 'buyer'
  const isBuyer = order.buyer_id === user?.id
  const refId = `#NAG-${order.id.substring(0, 8).toUpperCase()}`
  const productLeg = legs.find(l => l.leg_type === 'product')
  const logisticsLeg = legs.find(l => l.leg_type === 'logistics')

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
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>₦{Number(order.total_amount).toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)' }}>Delivery to</span>
              <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>
                {viewerRole === 'provider' ? order.delivery_address : order.delivery_state}
              </span>
            </div>
          </div>
        </div>

        {/* ── Contact cards — privacy-aware ── */}
        <div className="section-label">Who's involved</div>

        {/* Buyer sees: provider contact, farmer name+location only */}
        {viewerRole === 'buyer' && (
          <>
            {logisticsLeg?.provider && (
              <ContactCard viewerRole="buyer" type="provider" person={logisticsLeg.provider}
                vehiclePhoto={logisticsLeg.logistics_services?.photos?.[0]} />
            )}
            {productLeg?.provider && (
              <ContactCard viewerRole="buyer" type="farmer" person={{ full_name: productLeg.provider.full_name, state: order.delivery_state }} />
            )}
          </>
        )}

        {/* Farmer sees: provider contact only, never buyer */}
        {viewerRole === 'farmer' && logisticsLeg?.provider && (
          <ContactCard viewerRole="farmer" type="provider" person={logisticsLeg.provider}
            vehiclePhoto={logisticsLeg.logistics_services?.photos?.[0]} />
        )}
        {viewerRole === 'farmer' && !logisticsLeg && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
            No logistics provider attached to this order — buyer is arranging their own pickup.
          </div>
        )}

        {/* Provider sees: full farmer + buyer contact */}
        {viewerRole === 'provider' && (
          <>
            {productLeg?.provider && (
              <ContactCard viewerRole="provider" type="farmer" person={{ ...productLeg.provider, address: order.delivery_address }} />
            )}
            {order.buyerInfo && (
              <ContactCard viewerRole="provider" type="buyer" person={{ ...order.buyerInfo, address: order.delivery_address }} />
            )}
          </>
        )}

        {/* Each leg status */}
        {legs.map(leg => {
          const info = STATUS_INFO[leg.status] || STATUS_INFO.pending
          const stepIndex = LEG_STATUS_STEPS.indexOf(leg.status)
          const isProductLeg = leg.leg_type === 'product'
          const canConfirm = isBuyer && leg.status === 'in_progress'

          return (
            <div key={leg.id} className="card" style={{ marginBottom: 12, marginTop: 14 }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {isProductLeg ? (leg.products?.name || 'Product') : (leg.logistics_services?.name || 'Logistics')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {isProductLeg ? `${leg.quantity} ${leg.products?.unit}` : leg.logistics_services?.vehicle_type?.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: info.bg, color: info.color, flexShrink: 0, marginLeft: 8 }}>
                    {info.label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  {['Paid', 'Confirmed', 'In transit', 'Delivered'].map((step, i) => {
                    const done = stepIndex > i
                    const active = stepIndex === i + 1
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: done || active ? 'var(--green)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap' }}>{step}</div>
                        </div>
                        {i < 3 && <div style={{ flex: 1, height: 2, background: done ? 'var(--green)' : 'var(--border)', margin: '0 2px', marginBottom: 12 }} />}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: leg.status === 'completed' || canConfirm ? 10 : 0 }}>
                  <span>{isProductLeg ? 'Farmer receives' : 'Provider receives'}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>₦{Number(leg.leg_payout).toLocaleString()}</span>
                </div>

                {leg.status === 'completed' && (
                  <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#27500A', textAlign: 'center' }}>
                    ✓ Payment of ₦{Number(leg.leg_payout).toLocaleString()} released to provider
                  </div>
                )}

                {canConfirm && (
                  <button className="btn btn-primary btn-full" onClick={() => confirmDelivery(leg.id)} disabled={confirming === leg.id} style={{ marginTop: 4 }}>
                    {confirming === leg.id ? 'Confirming...' : `Confirm ${isProductLeg ? 'goods received' : 'delivery done'}`}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Review prompt */}
        {order.status === 'completed' && isBuyer && (
          <div style={{ background: 'var(--green-light)', borderRadius: 12, padding: '14px 16px', marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>⭐</div>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>How was your experience?</div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Leave a review to help other buyers</p>
            <Link to={`/review/${order.id}`} className="btn btn-primary btn-sm" style={{ display: 'inline-block' }}>Leave a review</Link>
          </div>
        )}
      </div>
    </div>
  )
}

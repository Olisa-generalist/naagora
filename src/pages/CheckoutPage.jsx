// src/pages/CheckoutPage.jsx
// ─────────────────────────────────────────────
// NAAGORA FEE MODEL — 5% from EVERY party involved:
//   - Buyer pays: subtotal + 5% buyer fee (shown as "Platform fee" at checkout)
//   - Farmer receives: their leg amount - 5% (95% of listed price)
//   - Logistics provider receives: their leg amount - 5% (95% of listed price)
// Total Naagora revenue per full transaction (product + logistics)
// = 5% (buyer) + 5% (farmer) + 5% (provider) = up to 15% of subtotal.
// This is a deliberate business decision — Naagora charges every
// party for the value of bringing them together safely via escrow.
// Fully disclosed to each party at the relevant point in their flow.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const PLATFORM_FEE_PERCENT = 5 // applied independently to buyer, farmer, and provider

const STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara'
]

export default function CheckoutPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { product, quantity } = location.state || {}

  const [address, setAddress] = useState('')
  const [deliveryState, setDeliveryState] = useState('')
  const [logisticsServices, setLogisticsServices] = useState([])
  const [selectedLogistics, setSelectedLogistics] = useState(null)
  const [loadingLogistics, setLoadingLogistics] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (!product) { navigate('/'); return }
    fetchLogistics()
  }, [])

  async function fetchLogistics() {
    setLoadingLogistics(true)
    const { data } = await supabase
      .from('logistics_services')
      .select(`*, users!logistics_services_provider_id_fkey ( id, full_name )`)
      .eq('is_available', true)
      .eq('is_verified', true)
      .order('base_price', { ascending: true })
      .limit(10)
    setLogisticsServices(data || [])
    setLoadingLogistics(false)
  }

  if (!product) return null

  // ── Money calculations — fee applied per-leg, independently ──
  const productSubtotal = product.price_per_unit * quantity
  const logisticsAmount = selectedLogistics?.base_price || 0

  // Buyer-side fee: 5% of EACH leg they're paying for, summed
  const buyerFeeOnProduct = round2(productSubtotal * (PLATFORM_FEE_PERCENT / 100))
  const buyerFeeOnLogistics = selectedLogistics ? round2(logisticsAmount * (PLATFORM_FEE_PERCENT / 100)) : 0
  const totalBuyerFee = round2(buyerFeeOnProduct + buyerFeeOnLogistics)

  const subtotal = productSubtotal + logisticsAmount
  const total = round2(subtotal + totalBuyerFee)

  // Seller-side payouts: each provider receives 95% of THEIR leg
  const farmerPayout = round2(productSubtotal * (1 - PLATFORM_FEE_PERCENT / 100))
  const providerPayout = selectedLogistics ? round2(logisticsAmount * (1 - PLATFORM_FEE_PERCENT / 100)) : 0

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100 }
  function formatMoney(n) { return '₦' + Number(n).toLocaleString() }

  async function handlePay() {
    if (!address.trim()) { toast.error('Please enter your delivery address'); return }
    if (!deliveryState) { toast.error('Please select your delivery state'); return }
    setPaying(true)

    try {
      const { data: farmerProfile } = await supabase
        .from('users')
        .select('business_address')
        .eq('id', product.farmer_id)
        .single()

      const pickupAddress = farmerProfile?.business_address
        || [product.lga, product.state].filter(Boolean).join(', ')
        || product.state
        || 'Pickup address not specified by farmer'

      const orderType = selectedLogistics ? 'product_with_logistics' : 'product'

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          order_type: orderType,
          delivery_address: address,
          delivery_state: deliveryState,
          pickup_address: pickupAddress,
          pickup_state: product.state || null,
          subtotal,
          platform_fee: totalBuyerFee,
          total_amount: total,
          status: 'pending',
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Product leg — farmer pays 5% too, receives 95% of their listed price
      const { error: legError } = await supabase.from('order_legs').insert({
        order_id: order.id,
        leg_type: 'product',
        provider_id: product.farmer_id,
        product_id: product.id,
        quantity,
        unit_price: product.price_per_unit,
        leg_amount: productSubtotal,
        leg_payout: farmerPayout,
        status: 'pending',
      })
      if (legError) throw legError

      // Optional logistics leg — provider pays 5% too, receives 95%
      if (selectedLogistics) {
        const logisticsProviderId = selectedLogistics.provider_id || selectedLogistics.users?.id
        if (!logisticsProviderId) console.warn('No provider_id found for logistics service', selectedLogistics)

        await supabase.from('order_legs').insert({
          order_id: order.id,
          leg_type: 'logistics',
          provider_id: logisticsProviderId,
          logistics_service_id: selectedLogistics.id,
          leg_amount: logisticsAmount,
          leg_payout: providerPayout,
          status: 'pending',
        })
      }

      await supabase
        .from('products')
        .update({ quantity_available: product.quantity_available - quantity })
        .eq('id', product.id)

      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
      if (!paystackKey) throw new Error('Paystack key not configured')

      const reference = `NAG-${order.id.substring(0, 8)}-${Date.now()}`

      await supabase.from('payments').insert({
        order_id: order.id,
        buyer_id: user.id,
        amount: total,
        platform_fee: totalBuyerFee,
        paystack_reference: reference,
        status: 'pending',
      })

      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: profile?.email || user.email,
        amount: Math.round(total * 100),
        currency: 'NGN',
        ref: reference,
        metadata: {
          order_id: order.id,
          buyer_name: profile?.full_name,
          custom_fields: [
            { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
            { display_name: 'Product', variable_name: 'product', value: product.name },
          ]
        },
        onClose: () => {
          toast('Payment cancelled. Your order is saved — you can pay later.')
          setPaying(false)
          navigate(`/orders/${order.id}`)
        },
        callback: (response) => {
          handlePaymentSuccess(order.id, reference)
        }
      })

      handler.openIframe()
    } catch (err) {
      console.error('Checkout error:', err)
      toast.error('Something went wrong. Please try again.')
      setPaying(false)
    }
  }

  async function handlePaymentSuccess(orderId, reference) {
    try {
      await supabase
        .from('payments')
        .update({ status: 'held', paid_at: new Date().toISOString() })
        .eq('paystack_reference', reference)

      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId)

      await supabase
        .from('order_legs')
        .update({ status: 'paid_held' })
        .eq('order_id', orderId)

      const { notifyOrderPaid } = await import('../lib/notifications')
      await notifyOrderPaid(orderId)

      toast.success('Payment successful! Order confirmed.')
      navigate(`/orders/${orderId}`)
    } catch (err) {
      console.error('Post-payment update error:', err)
      toast.success('Payment received! Redirecting to your order...')
      navigate(`/orders/${orderId}`)
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1>Checkout</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>

        {/* Product summary */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body" style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)' }}>
              {product.photos?.[0]
                ? <img src={product.photos[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{product.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {quantity} {product.unit} × {formatMoney(product.price_per_unit)}
              </div>
              <div style={{ fontWeight: 600, color: 'var(--green)', marginTop: 4 }}>
                {formatMoney(productSubtotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Delivery address */}
        <div className="section-label">Delivery address</div>
        <div className="input-group">
          <label>Full address *</label>
          <textarea placeholder="House number, street name, area..." value={address} onChange={e => setAddress(e.target.value)} rows={2} required />
        </div>
        <div className="input-group">
          <label>State *</label>
          <select value={deliveryState} onChange={e => setDeliveryState(e.target.value)} required>
            <option value="">Select delivery state</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Logistics selection */}
        <div className="section-label">
          Add logistics provider
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400, marginLeft: 6, textTransform: 'none' }}>optional</span>
        </div>

        {loadingLogistics ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
        ) : logisticsServices.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0', marginBottom: 8 }}>
            No logistics providers available right now. You can arrange your own delivery.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <div onClick={() => setSelectedLogistics(null)} style={{
              border: `1.5px solid ${!selectedLogistics ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
              background: !selectedLogistics ? 'var(--green-light)' : 'var(--surface)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>I will arrange my own delivery</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No logistics cost added</div>
              </div>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${!selectedLogistics ? 'var(--green)' : 'var(--border-2)'}`, background: !selectedLogistics ? 'var(--green)' : 'transparent', flexShrink: 0 }} />
            </div>

            {logisticsServices.map(ls => (
              <div key={ls.id} onClick={() => setSelectedLogistics(ls)} style={{
                border: `1.5px solid ${selectedLogistics?.id === ls.id ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                background: selectedLogistics?.id === ls.id ? 'var(--green-light)' : 'var(--surface)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{ls.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{ls.vehicle_type?.replace(/_/g, ' ')} · {ls.users?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500, marginTop: 2 }}>+{formatMoney(ls.base_price)}</div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedLogistics?.id === ls.id ? 'var(--green)' : 'var(--border-2)'}`, background: selectedLogistics?.id === ls.id ? 'var(--green)' : 'transparent', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}

        {/* Price breakdown — buyer side */}
        <div className="section-label">Your price breakdown</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: '0 14px' }}>
            {[
              { label: `${product.name} (${quantity} ${product.unit})`, value: formatMoney(productSubtotal) },
              { label: `Naagora fee on product (5%)`, value: formatMoney(buyerFeeOnProduct), muted: true },
              ...(selectedLogistics ? [
                { label: `Logistics — ${selectedLogistics.name}`, value: formatMoney(logisticsAmount) },
                { label: `Naagora fee on logistics (5%)`, value: formatMoney(buyerFeeOnLogistics), muted: true },
              ] : []),
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13, color: row.muted ? 'var(--text-3)' : 'var(--text-2)' }}>{row.label}</span>
                <span style={{ fontSize: 13, color: row.muted ? 'var(--text-3)' : 'var(--text)' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Fee transparency notice */}
        <div style={{ background: '#FAEEDA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#633806', lineHeight: 1.6 }}>
          ℹ️ Naagora charges a 5% service fee to every party in a transaction — buyer, farmer, and logistics provider — to fund secure escrow, dispute protection, and platform operations.
        </div>

        {/* Escrow notice */}
        <div style={{ background: 'var(--green-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <p style={{ fontSize: 12, color: 'var(--green-dark)', lineHeight: 1.6, margin: 0 }}>
            Your payment is held securely by Naagora and only released after you confirm delivery.
          </p>
        </div>

        <button className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }} onClick={handlePay} disabled={paying}>
          {paying ? 'Opening payment...' : `Pay ${formatMoney(total)} securely`}
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 10 }}>
          Powered by Paystack · Your card details are never stored by Naagora
        </p>
      </div>
    </div>
  )
}

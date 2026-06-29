// src/pages/ProductDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const EMOJI_MAP = {
  vegetable: '🥬', tuber: '🍠', fruit: '🍅',
  grain: '🌾', livestock: '🐄', default: '📦'
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [product, setProduct] = useState(null)
  const [farmer, setFarmer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => { fetchProduct() }, [id])

  async function fetchProduct() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`*, users ( id, full_name, email )`)
      .eq('id', id)
      .single()

    if (error || !data) {
      toast.error('Product not found')
      navigate('/')
      return
    }
    setProduct(data)
    setFarmer(data.users)
    setQuantity(data.min_order_quantity || 1)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  if (!product) return null

  const photos = product.photos || []
  const emoji = EMOJI_MAP[product.category] || EMOJI_MAP.default
  const total = (quantity * product.price_per_unit).toLocaleString()
  const isFarmerOwner = profile?.id === product.farmer_id
  const canOrder = profile?.role === 'buyer' || profile?.role === 'farmer' || profile?.role === 'provider'

  return (
    <div className="page">
      {/* Header */}
      <div className="topbar">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1 style={{ fontSize: 16 }}>{product.name}</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}>

        {/* Photo gallery */}
        <div style={{ position: 'relative', background: 'var(--surface-2)', height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photos.length > 0 ? (
            <img
              src={photos[activePhoto]}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 72 }}>{emoji}</span>
          )}

          {/* Watermark already baked into image during upload — no overlay needed */}

          {/* Photo dots */}
          {photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
              {photos.map((_, i) => (
                <div key={i} onClick={() => setActivePhoto(i)} style={{
                  width: i === activePhoto ? 16 : 6, height: 6,
                  borderRadius: 3, background: i === activePhoto ? '#fff' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto' }}>
            {photos.map((url, i) => (
              <div key={i} onClick={() => setActivePhoto(i)} style={{
                width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                border: i === activePhoto ? '2px solid var(--green)' : '2px solid transparent',
                cursor: 'pointer'
              }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '0 16px' }}>
          {/* Title + price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14, marginBottom: 4 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>{product.name}</h2>
              <p style={{ fontSize: 12, marginTop: 2 }}>{farmer?.full_name} · {product.state || 'Nigeria'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
                ₦{Number(product.price_per_unit).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>per {product.unit}</div>
            </div>
          </div>

          {/* Availability */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <span className="badge badge-green">✓ {Math.floor(product.quantity_available)} {product.unit}s available</span>
            {product.harvest_date && (
              <span className="badge badge-amber">
                Harvested {new Date(product.harvest_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>

          {/* Trust strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { icon: '✓', label: 'Verified', sub: 'Farmer ID checked' },
              { icon: '🔒', label: 'Escrow', sub: 'Payment protected' },
              { icon: '⭐', label: '4.8 rating', sub: 'From buyers' },
            ].map((t, i) => (
              <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: 'var(--green)' }}>{t.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t.sub}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {product.description && (
            <>
              <div className="section-label">About this product</div>
              <p style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>{product.description}</p>
            </>
          )}

          {/* Details */}
          <div className="section-label">Product details</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '0 14px' }}>
              {[
                { label: 'Category', value: product.category || 'General' },
                { label: 'Unit', value: product.unit },
                { label: 'Min order', value: `${product.min_order_quantity || 1} ${product.unit}` },
                { label: 'Location', value: [product.lga, product.state].filter(Boolean).join(', ') || 'Nigeria' },
                { label: 'Harvest date', value: product.harvest_date ? new Date(product.harvest_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not specified' },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none'
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Escrow notice */}
          <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <p style={{ fontSize: 12, color: '#085041', lineHeight: 1.6, margin: 0 }}>
              Your payment is held safely by Naagora and only released to the farmer after you confirm delivery.
            </p>
          </div>
        </div>
      </div>

      {/* Order bar — fixed at bottom above nav */}
      {!isFarmerOwner && product.is_available && (
        <div style={{
          position: 'fixed', bottom: 64, left: 0, right: 0,
          maxWidth: 480, margin: '0 auto',
          background: 'var(--surface)', borderTop: '0.5px solid var(--border)',
          padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center',
          zIndex: 30
        }}>
          {/* Quantity stepper */}
          <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--border-2)', borderRadius: 8 }}>
            <button onClick={() => setQuantity(q => Math.max(product.min_order_quantity || 1, q - 1))}
              style={{ width: 34, height: 38, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>−</button>
            <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(product.quantity_available, q + 1))}
              style={{ width: 34, height: 38, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>+</button>
          </div>
          <button
            className="btn btn-primary"
            style={{ flex: 1, height: 38 }}
            onClick={() => navigate('/checkout', { state: { product, quantity } })}
          >
            Order · ₦{total}
          </button>
        </div>
      )}

      {isFarmerOwner && (
        <div style={{ padding: '0 16px 16px', paddingBottom: 80 }}>
          <div style={{ background: 'var(--amber-light)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--amber)', textAlign: 'center' }}>
            This is your product listing
          </div>
        </div>
      )}
    </div>
  )
}

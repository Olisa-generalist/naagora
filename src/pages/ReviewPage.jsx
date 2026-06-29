// src/pages/ReviewPage.jsx
// Buyer leaves reviews for farmer and logistics provider
// after an order is completed
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

function StarRating({ value, onChange, label }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button" onClick={() => onChange(star)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 28, padding: 0,
              color: star <= value ? '#BA7517' : 'var(--border-2)',
              transition: 'color 0.1s'
            }}>
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [legs, setLegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reviews, setReviews] = useState({}) // { legId: { rating, comment } }
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { fetchLegs() }, [orderId])

  async function fetchLegs() {
    const { data } = await supabase
      .from('order_legs')
      .select(`
        id, leg_type, provider_id, status,
        products ( name ),
        logistics_services ( name ),
        users!order_legs_provider_id_fkey ( full_name )
      `)
      .eq('order_id', orderId)
      .eq('status', 'completed')

    setLegs(data || [])

    // Check if already reviewed
    if (data?.length) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('order_leg_id')
        .in('order_leg_id', data.map(l => l.id))
        .eq('reviewer_id', user.id)
      if (existing?.length === data.length) setSubmitted(true)
    }

    // Initialize review state
    const init = {}
    data?.forEach(leg => { init[leg.id] = { rating: 5, comment: '' } })
    setReviews(init)
    setLoading(false)
  }

  function setLegReview(legId, field, value) {
    setReviews(prev => ({ ...prev, [legId]: { ...prev[legId], [field]: value } }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Validate at least one rating
    const anyRated = Object.values(reviews).some(r => r.rating > 0)
    if (!anyRated) { toast.error('Please rate at least one provider'); return }
    setSubmitting(true)

    try {
      const inserts = legs.map(leg => ({
        order_leg_id: leg.id,
        reviewer_id: user.id,
        reviewee_id: leg.provider_id,
        rating: reviews[leg.id]?.rating || 5,
        comment: reviews[leg.id]?.comment || null,
      }))

      const { error } = await supabase.from('reviews').insert(inserts)
      if (error) throw error

      // Update provider ratings
      for (const leg of legs) {
        const { data: providerReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', leg.provider_id)
        if (providerReviews?.length) {
          const avg = providerReviews.reduce((sum, r) => sum + r.rating, 0) / providerReviews.length
          await supabase.from('users').update({
            rating: Math.round(avg * 10) / 10,
            total_reviews: providerReviews.length
          }).eq('id', leg.provider_id)
        }
      }

      setSubmitted(true)
      toast.success('Thank you for your review!')
    } catch (err) {
      toast.error('Could not submit review. Try again.')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  if (submitted) return (
    <div className="page">
      <div className="page-content" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⭐</div>
        <h2>Thank you!</h2>
        <p style={{ marginTop: 8, marginBottom: 24 }}>Your review helps other buyers make better decisions.</p>
        <button className="btn btn-primary btn-full" onClick={() => navigate('/')}>
          Back to marketplace
        </button>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="topbar">
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}>←</button>
        <h1>Leave a review</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 }}>
          How was your experience? Your honest review helps farmers and logistics providers improve, and helps other buyers make better decisions.
        </p>

        {legs.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📝</div>
            <h3>Nothing to review</h3>
            <p>Reviews are available once your order is delivered.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {legs.map(leg => {
              const isProduct = leg.leg_type === 'product'
              const name = isProduct ? leg.products?.name : leg.logistics_services?.name
              const providerName = leg.users?.full_name
              return (
                <div key={leg.id} className="card" style={{ marginBottom: 16 }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: isProduct ? 'var(--green-light)' : '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {isProduct ? '🌾' : '🚚'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{providerName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {isProduct ? `Farmer · ${name}` : `Logistics · ${name}`}
                        </div>
                      </div>
                    </div>

                    <StarRating
                      value={reviews[leg.id]?.rating || 0}
                      onChange={v => setLegReview(leg.id, 'rating', v)}
                      label={isProduct ? 'How was the produce quality?' : 'How was the delivery service?'}
                    />

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 13 }}>Comment (optional)</label>
                      <textarea
                        placeholder={isProduct
                          ? 'Was the produce fresh? Did quantity match? Would you order again?'
                          : 'Was pickup on time? Was the driver professional? Would you hire again?'}
                        value={reviews[leg.id]?.comment || ''}
                        onChange={e => setLegReview(leg.id, 'comment', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            <button className="btn btn-primary btn-full" type="submit" disabled={submitting} style={{ height: 50 }}>
              {submitting ? 'Submitting...' : 'Submit review'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

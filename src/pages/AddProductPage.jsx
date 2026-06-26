// src/pages/AddProductPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'vegetable', label: '🥬 Vegetables' },
  { id: 'tuber',     label: '🍠 Tubers' },
  { id: 'fruit',     label: '🍅 Fruits' },
  { id: 'grain',     label: '🌾 Grains' },
  { id: 'livestock', label: '🐄 Livestock' },
  { id: 'other',     label: '📦 Other' },
]

const UNITS = ['kg', 'bag', 'crate', 'bunch', 'piece', 'litre', 'ton', 'carton']

const STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara'
]

export default function AddProductPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photos, setPhotos] = useState([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price_per_unit: '',
    unit: 'kg',
    quantity_available: '',
    min_order_quantity: '1',
    state: '',
    lga: '',
    harvest_date: '',
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB')
      return
    }
    setUploadingPhoto(true)
    const fileName = `${user.id}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('product-photos')
      .upload(fileName, file)

    if (error) {
      toast.error('Photo upload failed. Try again.')
      setUploadingPhoto(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('product-photos')
      .getPublicUrl(fileName)

    setPhotos(prev => [...prev, urlData.publicUrl])
    toast.success('Photo uploaded!')
    setUploadingPhoto(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.price_per_unit || !form.quantity_available || !form.category) {
      toast.error('Please fill in all required fields')
      return
    }
    setLoading(true)

    const { error } = await supabase.from('products').insert({
      farmer_id: user.id,
      name: form.name,
      description: form.description || null,
      category: form.category,
      price_per_unit: Number(form.price_per_unit),
      unit: form.unit,
      quantity_available: Number(form.quantity_available),
      min_order_quantity: Number(form.min_order_quantity) || 1,
      state: form.state || null,
      lga: form.lga || null,
      harvest_date: form.harvest_date || null,
      photos: photos,
      is_available: true,
    })

    if (error) {
      toast.error('Could not save product. Try again.')
      setLoading(false)
      return
    }

    toast.success('Product listed! Buyers can now see it.')
    navigate('/dashboard')
  }

  return (
    <div className="page">
      <div className="topbar">
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-2)', padding: '0 8px 0 0' }}
          aria-label="Go back"
        >
          ←
        </button>
        <h1>List a product</h1>
      </div>

      <div className="page-content" style={{ paddingTop: 20 }}>
        <form onSubmit={handleSubmit}>

          {/* Photos */}
          <div className="section-label">Photos (buyers trust photos)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {photos.map((url, i) => (
              <div key={i} style={{
                width: 72, height: 72, borderRadius: 8, overflow: 'hidden',
                border: '0.5px solid var(--border)', flexShrink: 0
              }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
            {photos.length < 4 && (
              <label style={{
                width: 72, height: 72, borderRadius: 8, cursor: 'pointer',
                border: '1.5px dashed var(--border-2)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--text-3)', gap: 4
              }}>
                {uploadingPhoto ? <div className="spinner" style={{ width: 20, height: 20 }} /> : <>
                  <span style={{ fontSize: 22 }}>📷</span>
                  Add photo
                </>}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* Basic info */}
          <div className="section-label">Product details</div>

          <div className="input-group">
            <label>Product name *</label>
            <input placeholder="e.g. Fresh Tomatoes" value={form.name} onChange={set('name')} required />
          </div>

          <div className="input-group">
            <label>Category *</label>
            <select value={form.category} onChange={set('category')} required>
              <option value="">Select category</option>
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea
              placeholder="Tell buyers about your produce — variety, freshness, how it was grown..."
              value={form.description}
              onChange={set('description')}
              rows={3}
            />
          </div>

          {/* Pricing */}
          <div className="section-label">Pricing & quantity</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Price (₦) *</label>
              <input
                type="number" placeholder="4500"
                value={form.price_per_unit} onChange={set('price_per_unit')}
                min="1" required
              />
            </div>
            <div className="input-group">
              <label>Per (unit) *</label>
              <select value={form.unit} onChange={set('unit')}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Quantity available *</label>
              <input
                type="number" placeholder="50"
                value={form.quantity_available} onChange={set('quantity_available')}
                min="1" required
              />
            </div>
            <div className="input-group">
              <label>Minimum order</label>
              <input
                type="number" placeholder="1"
                value={form.min_order_quantity} onChange={set('min_order_quantity')}
                min="1"
              />
            </div>
          </div>

          {/* Location */}
          <div className="section-label">Farm location</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>State</label>
              <select value={form.state} onChange={set('state')}>
                <option value="">Select state</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>LGA / Area</label>
              <input placeholder="e.g. Ifo" value={form.lga} onChange={set('lga')} />
            </div>
          </div>

          {/* Harvest date */}
          <div className="input-group">
            <label>Harvest date</label>
            <input type="date" value={form.harvest_date} onChange={set('harvest_date')} />
          </div>

          {/* Escrow reminder */}
          <div style={{
            background: 'var(--green-light)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 20,
            fontSize: 12, color: 'var(--green-dark)', lineHeight: 1.6
          }}>
            🔒 Naagora holds buyer payment safely until they confirm delivery — then releases it to your wallet within 24 hours.
          </div>

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Listing product...' : 'List product for sale'}
          </button>
        </form>
      </div>
    </div>
  )
}

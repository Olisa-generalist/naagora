// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CATEGORIES = [
  { id: null,        label: 'All' },
  { id: 'vegetable', label: 'Vegetables' },
  { id: 'tuber',     label: 'Tubers' },
  { id: 'fruit',     label: 'Fruits' },
  { id: 'grain',     label: 'Grains' },
  { id: 'livestock', label: 'Livestock' },
]

// Emoji fallback when no photo uploaded
const EMOJI_MAP = {
  vegetable: '🥬', tuber: '🍠', fruit: '🍅',
  grain: '🌾', livestock: '🐄', default: '📦'
}

export default function HomePage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(null)

  useEffect(() => { fetchProducts() }, [search, category])

  async function fetchProducts() {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(`
        id, name, price_per_unit, unit, quantity_available,
        category, photos, state,
        users ( full_name )
      `)
      .eq('is_available', true)
      .gt('quantity_available', 0)
      .order('created_at', { ascending: false })
      .limit(40)

    if (category) query = query.eq('category', category)
    if (search.length > 1) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (!error) setProducts(data || [])
    setLoading(false)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="topbar-logo">FarmLink</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
            Good day, {firstName}
          </p>
        </div>
        <Link to="/profile" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: 22 }}>
          👤
        </Link>
      </div>

      <div className="page-content">
        {/* Search */}
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search tomatoes, yam, pepper..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category chips */}
        <div className="chips">
          {CATEGORIES.map(c => (
            <button
              key={c.label}
              className={`chip ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🌱</div>
            <h3>Nothing here yet</h3>
            <p>
              {search
                ? `No products matching "${search}"`
                : 'No products in this category yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="section-label">{products.length} products available</div>
            <div className="product-grid">
              {products.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product: p }) {
  const photo = p.photos?.[0]
  const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default
  const farmerName = p.users?.full_name || 'Unknown farmer'

  return (
    <Link to={`/product/${p.id}`} className="product-card">
      <div className="product-card-img">
        {photo
          ? <img src={photo} alt={p.name} loading="lazy" />
          : emoji}
      </div>
      <div className="product-card-body">
        <div className="product-card-name">{p.name}</div>
        <div className="product-card-farmer">{farmerName} · {p.state || 'Nigeria'}</div>
        <div className="product-card-footer">
          <div>
            <div className="product-card-price">
              ₦{Number(p.price_per_unit).toLocaleString()}
            </div>
            <div className="product-card-unit">per {p.unit}</div>
          </div>
          <span className="badge badge-green">{Math.floor(p.quantity_available)} left</span>
        </div>
      </div>
    </Link>
  )
}

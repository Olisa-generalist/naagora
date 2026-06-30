// src/components/ContactCard.jsx
// ─────────────────────────────────────────────
// Shows contact details for an order leg's other party,
// respecting Naagora's privacy rules:
//
//   Viewer = Buyer    → sees Provider (name+phone+vehicle), Farmer (name+location only)
//   Viewer = Farmer   → sees Provider (name+phone+vehicle), NOT buyer contact
//   Viewer = Provider → sees Farmer (name+phone+address), Buyer (name+phone+address)
//
// This component is given a "viewerRole" and the leg/order data,
// and decides what to render — never expose more than the rule allows.
// ─────────────────────────────────────────────

export default function ContactCard({ viewerRole, person, type, vehiclePhoto }) {
  // type: 'provider' | 'farmer' | 'buyer'
  // person: { full_name, phone, address, state }

  if (!person) return null

  // Determine what fields to show based on viewer + person type
  let showPhone = false
  let showAddress = false
  let showVehicle = false

  if (viewerRole === 'buyer') {
    if (type === 'provider') { showPhone = true; showVehicle = true }
    if (type === 'farmer') { /* name + location only */ }
  }
  if (viewerRole === 'farmer') {
    if (type === 'provider') { showPhone = true; showVehicle = true }
    // farmer never sees buyer contact
  }
  if (viewerRole === 'provider') {
    if (type === 'farmer' || type === 'buyer') { showPhone = true; showAddress = true }
  }

  const ROLE_LABELS = {
    provider: { icon: '🚚', label: 'Logistics provider' },
    farmer:   { icon: '🌾', label: 'Farmer' },
    buyer:    { icon: '🛒', label: 'Buyer' },
  }
  const roleInfo = ROLE_LABELS[type] || { icon: '👤', label: 'Contact' }

  return (
    <div style={{
      background: 'var(--surface-2, #f7f6f2)', borderRadius: 10,
      padding: '12px 14px', marginBottom: 10
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-3, #888)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {roleInfo.icon} {roleInfo.label}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {showVehicle && vehiclePhoto ? (
          <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src={vehiclePhoto} alt="Vehicle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border, #e5e3da)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {roleInfo.icon}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{person.full_name}</div>

          {showPhone && person.phone && (
            <a href={`tel:${person.phone}`} style={{ fontSize: 13, color: 'var(--green, #0F6E56)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              📞 {person.phone}
            </a>
          )}

          {showAddress && person.address && (
            <div style={{ fontSize: 12, color: 'var(--text-2, #5f5e5a)', marginTop: 2 }}>
              📍 {person.address}
            </div>
          )}

          {!showPhone && !showAddress && person.state && (
            <div style={{ fontSize: 12, color: 'var(--text-3, #888)', marginTop: 2 }}>
              📍 {person.state}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// src/components/BottomNav.jsx
import { Link, useLocation } from 'react-router-dom'

const BUYER_TABS = [
  { to: '/',        icon: HomeIcon,    label: 'Browse' },
  { to: '/orders',  icon: BagIcon,     label: 'Orders' },
  { to: '/profile', icon: PersonIcon,  label: 'Profile' },
]

const FARMER_TABS = [
  { to: '/dashboard',   icon: ChartIcon,  label: 'Dashboard' },
  { to: '/',            icon: HomeIcon,   label: 'Marketplace' },
  { to: '/add-product', icon: PlusIcon,   label: 'Add product' },
  { to: '/profile',     icon: PersonIcon, label: 'Profile' },
]

const PROVIDER_TABS = [
  { to: '/dashboard',  icon: ChartIcon,  label: 'Dashboard' },
  { to: '/',           icon: HomeIcon,   label: 'Marketplace' },
  { to: '/profile',    icon: PersonIcon, label: 'Profile' },
]

export default function BottomNav({ role }) {
  const { pathname } = useLocation()
  const tabs = role === 'farmer'
    ? FARMER_TABS
    : role === 'provider'
      ? PROVIDER_TABS
      : BUYER_TABS

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {tabs.map(tab => (
        <Link
          key={tab.to + tab.label}
          to={tab.to}
          className={`bottom-nav-item ${pathname === tab.to ? 'active' : ''}`}
          aria-current={pathname === tab.to ? 'page' : undefined}
        >
          <tab.icon />
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

function HomeIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> }
function BagIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg> }
function PersonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function ChartIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> }
function PlusIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> }

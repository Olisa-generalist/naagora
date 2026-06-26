// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './lib/AuthContext'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import OrdersPage from './pages/OrdersPage'
import ProfilePage from './pages/ProfilePage'
import FarmerDashboardPage from './pages/FarmerDashboardPage'
import AddProductPage from './pages/AddProductPage'
import ProviderDashboardPage from './pages/ProviderDashboardPage'
import AddServicePage from './pages/AddServicePage'
import BottomNav from './components/BottomNav'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function FullScreenSpinner() {
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )
}

function AppRoutes() {
  const { user, profile } = useAuth()

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Shared */}
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/product/:id" element={<ProtectedRoute><ProductDetailPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* Farmer routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            {profile?.role === 'provider'
              ? <ProviderDashboardPage />
              : <FarmerDashboardPage />}
          </ProtectedRoute>
        } />
        <Route path="/add-product" element={<ProtectedRoute><AddProductPage /></ProtectedRoute>} />

        {/* Logistics provider routes */}
        <Route path="/add-service" element={<ProtectedRoute><AddServicePage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {user && <BottomNav role={profile?.role} />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

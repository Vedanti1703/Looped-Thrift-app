import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import BottomNav from './components/BottomNav'
import WhatsappWidget from './components/WhatsappWidget'

// Pages
import LoginPage       from './pages/LoginPage'
import SignupPage      from './pages/SignupPage'
import VerifyOtpPage   from './pages/VerifyOtpPage'
import HomePage        from './pages/HomePage'
import DiscoverPage    from './pages/DiscoverPage'
import SwipePage       from './pages/SwipePage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage        from './pages/CartPage'
import UploadPage      from './pages/UploadPage'
import ProfilePage     from './pages/ProfilePage'
import ChatPage        from './pages/ChatPage'
import { RentPage, AuctionPage } from './pages/ComingSoonPages'

// Pages that show the bottom nav
const NAV_ROUTES = ['/', '/discover', '/swipe', '/cart', '/chat', '/profile', '/upload', '/rent', '/auction']

function AppContent() {
  return (
    <Routes>
      {/* Auth routes — no bottom nav */}
      <Route path="/login"      element={<LoginPage />} />
      <Route path="/signup"     element={<SignupPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />

      {/* App routes — with bottom nav */}
      <Route path="/"           element={<WithNav><HomePage /></WithNav>} />
      <Route path="/discover"   element={<WithNav><DiscoverPage /></WithNav>} />
      <Route path="/swipe"      element={<WithNav><SwipePage /></WithNav>} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/cart"       element={<WithNav><CartPage /></WithNav>} />
      <Route path="/upload"     element={<WithNav><UploadPage /></WithNav>} />
      <Route path="/profile"    element={<WithNav><ProfilePage /></WithNav>} />
      <Route path="/chat"       element={<WithNav><ChatPage /></WithNav>} />
      <Route path="/rent"       element={<WithNav><RentPage /></WithNav>} />
      <Route path="/auction"    element={<WithNav><AuctionPage /></WithNav>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Wrapper that renders bottom nav alongside page content
function WithNav({ children }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="max-w-lg mx-auto min-h-screen relative">
            <AppContent />
            <WhatsappWidget />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

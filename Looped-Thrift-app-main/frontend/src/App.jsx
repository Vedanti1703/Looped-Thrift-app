import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import BottomNav from './components/BottomNav'

// Pages
import SplashPage      from './pages/SplashPage'
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
import OrderConfirmationPage from './pages/OrderConfirmationPage'
import MyOrdersPage from './pages/MyOrdersPage'
import SellerDashboardPage from './pages/SellerDashboardPage'
import AdminDisputePage from './pages/AdminDisputePage'
import AdminAuctionVerificationPage from './pages/AdminAuctionVerificationPage'
import StyleMePage from './pages/StyleMePage'
import RentPage from './pages/RentPage'
import AuctionPage from './pages/AuctionPage'
import AuctionDetailPage from './pages/AuctionDetailPage'
import CreateAuctionPage from './pages/CreateAuctionPage'

// Pages that show the bottom nav
const NAV_ROUTES = ['/', '/discover', '/swipe', '/cart', '/chat', '/profile', '/upload', '/rent', '/auction', '/style-me']

function SplashRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!sessionStorage.getItem('splashSeen')) {
      navigate('/splash', { replace: true })
    }
  }, [])
  return null
}

function AppContent() {
  return (
    <>
      <SplashRedirect />
      <Routes>
        {/* Splash route */}
        <Route path="/splash" element={<SplashPage />} />

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
        <Route path="/order-confirmation/:orderId" element={<WithNav><OrderConfirmationPage /></WithNav>} />
        <Route path="/my-orders" element={<WithNav><MyOrdersPage /></WithNav>} />
        <Route path="/seller-dashboard" element={<WithNav><SellerDashboardPage /></WithNav>} />
        <Route path="/admin/disputes" element={<AdminDisputePage />} />
        <Route path="/admin/auctions" element={<AdminAuctionVerificationPage />} />
        <Route path="/style-me" element={<WithNav><StyleMePage /></WithNav>} />
        <Route path="/upload"     element={<WithNav><UploadPage /></WithNav>} />
        <Route path="/profile"    element={<WithNav><ProfilePage /></WithNav>} />
        <Route path="/chat"       element={<WithNav><ChatPage /></WithNav>} />
        <Route path="/rent"       element={<WithNav><RentPage /></WithNav>} />
        <Route path="/auction"    element={<WithNav><AuctionPage /></WithNav>} />
        <Route path="/auction/create" element={<WithNav><CreateAuctionPage /></WithNav>} />
        <Route path="/auction/:id" element={<AuctionDetailPage />} />

        {/* Fallback */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
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
          <div className="w-full max-w-lg mx-auto min-h-screen relative overflow-x-hidden">
            <AppContent />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

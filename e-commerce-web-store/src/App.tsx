// ============================================
// TechTools E-Commerce Store - Main App
// ============================================

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StripeProvider } from './contexts/StripeContext'
import Layout from './components/layout/Layout'
import ScrollToTop from './components/common/ScrollToTop'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderConfirmationPage from './pages/OrderConfirmationPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import OrdersPage from './pages/OrdersPage'
import WishlistPage from './pages/WishlistPage'
import PaymentMethodsPage from './pages/PaymentMethodsPage'
import SettingsPage from './pages/SettingsPage'
import SupportPage from './pages/SupportPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsOfServicePage from './pages/TermsOfServicePage'
import CookiePolicyPage from './pages/CookiePolicyPage'
import ContactPage from './pages/ContactPage'
import FAQPage from './pages/FAQPage'
import ShippingInfoPage from './pages/ShippingInfoPage'
import ReturnsPage from './pages/ReturnsPage'
import TrackOrderPage from './pages/TrackOrderPage'
import AboutPage from './pages/AboutPage'
import CareersPage from './pages/CareersPage'
import PressPage from './pages/PressPage'
import AffiliatePage from './pages/AffiliatePage'
import BlogPage from './pages/BlogPage'
import BlogPostPage from './pages/BlogPostPage'
import TrendingPage from './pages/TrendingPage'

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StripeProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path='/' element={<Layout />}>
              {/* Home */}
              <Route index element={<HomePage />} />

              {/* Products */}
              <Route path='products' element={<ProductsPage />} />
              <Route path='product/:slug' element={<ProductDetailPage />} />
              <Route path='category/:slug' element={<ProductsPage />} />
              <Route path='brand/:slug' element={<ProductsPage />} />
              <Route path='sale' element={<ProductsPage />} />
              <Route path='new-arrivals' element={<ProductsPage />} />
              <Route path='trending' element={<TrendingPage />} />
              <Route path='search' element={<ProductsPage />} />

              {/* Cart & Checkout */}
              <Route path='cart' element={<CartPage />} />
              <Route path='checkout' element={<CheckoutPage />} />
              <Route
                path='order-confirmation'
                element={<OrderConfirmationPage />}
              />
              <Route path='payment-cancelled' element={<PaymentCancelPage />} />

              {/* Auth */}
              <Route path='login' element={<LoginPage />} />
              <Route path='register' element={<RegisterPage />} />

              {/* User Profile */}
              <Route path='profile' element={<ProfilePage />} />
              <Route path='orders' element={<OrdersPage />} />
              <Route path='wishlist' element={<WishlistPage />} />
              <Route path='payment-methods' element={<PaymentMethodsPage />} />
              <Route path='settings' element={<SettingsPage />} />

              {/* Legal Pages */}
              <Route path='privacy' element={<PrivacyPolicyPage />} />
              <Route path='terms' element={<TermsOfServicePage />} />
              <Route path='cookies' element={<CookiePolicyPage />} />

              {/* Support Pages */}
              <Route path='support' element={<SupportPage />} />
              <Route path='contact' element={<ContactPage />} />
              <Route path='faq' element={<FAQPage />} />
              <Route path='shipping' element={<ShippingInfoPage />} />
              <Route path='returns' element={<ReturnsPage />} />
              <Route path='track-order' element={<TrackOrderPage />} />

              {/* Company Pages */}
              <Route path='about' element={<AboutPage />} />
              <Route path='careers' element={<CareersPage />} />
              <Route path='press' element={<PressPage />} />
              <Route path='affiliates' element={<AffiliatePage />} />

              {/* Blog */}
              <Route path='blog' element={<BlogPage />} />
              <Route path='blog/:slug' element={<BlogPostPage />} />

              {/* 404 - Fallback to Home */}
              <Route path='*' element={<HomePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StripeProvider>
    </QueryClientProvider>
  )
}

export default App

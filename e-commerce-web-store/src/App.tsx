// ============================================
// TechTools E-Commerce Store - Main App
// ============================================

import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StripeProvider } from './contexts/StripeContext'
import Layout from './components/layout/Layout'
import ScrollToTop from './components/common/ScrollToTop'
import PageViewTracker from './components/common/PageViewTracker'
import ReferralCapture from './components/common/ReferralCapture'
import CookieConsentBanner from './components/common/CookieConsentBanner'
import { initializeEventTracking } from './services/event-tracking'

const HomePage = lazy(() => import('./pages/HomePage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))
const BooksPage = lazy(() => import('./pages/BooksPage'))
const BookDetailPage = lazy(() => import('./pages/BookDetailPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const OrderConfirmationPage = lazy(
  () => import('./pages/OrderConfirmationPage'),
)
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SellerHubPage = lazy(() => import('./pages/SellerHubPage'))
const SellerSupportPage = lazy(() => import('./pages/SellerSupportPage'))
const CreatorDashboardLayout = lazy(
  () => import('./pages/creator-dashboard/CreatorDashboardLayout'),
)
const CreatorOverviewTab = lazy(() => import('./pages/creator-dashboard/OverviewTab'))
const CreatorStoreProductsTab = lazy(() => import('./pages/creator-dashboard/StoreProductsTab'))
const CreatorBooksTab = lazy(() => import('./pages/creator-dashboard/BooksTab'))
const CreatorDiscoverTab = lazy(() => import('./pages/creator-dashboard/DiscoverTab'))
const CreatorPerformanceTab = lazy(() => import('./pages/creator-dashboard/PerformanceTab'))
const CreatorEarningsTab = lazy(() => import('./pages/creator-dashboard/EarningsTab'))
const CreatorActivityTab = lazy(() => import('./pages/creator-dashboard/ActivityTab'))
const CreatorSettingsTab = lazy(() => import('./pages/creator-dashboard/SettingsTab'))
const SellerProfilePage = lazy(() => import('./pages/SellerProfilePage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const CollectionPage = lazy(() => import('./pages/CollectionPage'))
const ReferAndEarnPage = lazy(() => import('./pages/ReferAndEarnPage'))
const PaymentMethodsPage = lazy(() => import('./pages/PaymentMethodsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const ShippingInfoPage = lazy(() => import('./pages/ShippingInfoPage'))
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'))
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const CareersPage = lazy(() => import('./pages/CareersPage'))
const PressPage = lazy(() => import('./pages/PressPage'))
const AffiliatePage = lazy(() => import('./pages/AffiliatePage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const DownloadAppPage = lazy(() => import('./pages/DownloadAppPage'))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'))

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
  useEffect(() => {
    // Initialize event tracking on app load
    initializeEventTracking()
  }, [])

  const routeFallback = (
    <div className='min-h-[40vh] flex items-center justify-center text-gray-500'>
      Loading...
    </div>
  )

  return (
    <QueryClientProvider client={queryClient}>
      <StripeProvider>
        <BrowserRouter>
          <ScrollToTop />
          <PageViewTracker />
          <ReferralCapture />
          <CookieConsentBanner />
          <Suspense fallback={routeFallback}>
            <Routes>
              {/* Discover -- deliberately outside Layout, a full-screen
                  immersive feed with no site header/footer chrome, same
                  as how a TikTok/Reels-style takeover should behave. */}
              <Route path='discover' element={<DiscoverPage />} />

              <Route path='/' element={<Layout />}>
                {/* Home */}
                <Route index element={<HomePage />} />

                {/* Products */}
                <Route path='products' element={<ProductsPage />} />
                <Route path='product/:slug' element={<ProductDetailPage />} />
                <Route path='category/:slug' element={<ProductsPage />} />
                <Route path='brand/:slug' element={<ProductsPage />} />
                <Route path='seller/:handle' element={<SellerProfilePage />} />
                <Route path='books' element={<BooksPage />} />
                <Route path='books/:id' element={<BookDetailPage />} />
                <Route path='sale' element={<ProductsPage />} />
                <Route path='new-arrivals' element={<ProductsPage />} />
                <Route path='search' element={<ProductsPage />} />

                {/* Cart & Checkout */}
                <Route path='cart' element={<CartPage />} />
                <Route path='checkout' element={<CheckoutPage />} />
                <Route
                  path='order-confirmation'
                  element={<OrderConfirmationPage />}
                />
                <Route
                  path='payment-cancelled'
                  element={<PaymentCancelPage />}
                />

                {/* Auth */}
                <Route path='login' element={<LoginPage />} />
                <Route path='register' element={<RegisterPage />} />

                {/* User Profile */}
                <Route path='profile' element={<ProfilePage />} />
                <Route path='seller-hub' element={<SellerHubPage />} />
                <Route path='seller-hub/support' element={<SellerSupportPage />} />
                <Route path='creator-dashboard' element={<CreatorDashboardLayout />}>
                  <Route index element={<Navigate to='overview' replace />} />
                  <Route path='overview' element={<CreatorOverviewTab />} />
                  <Route path='store' element={<CreatorStoreProductsTab />} />
                  <Route path='books' element={<CreatorBooksTab />} />
                  <Route path='discover' element={<CreatorDiscoverTab />} />
                  <Route path='performance' element={<CreatorPerformanceTab />} />
                  <Route path='earnings' element={<CreatorEarningsTab />} />
                  <Route path='activity' element={<CreatorActivityTab />} />
                  <Route path='settings' element={<CreatorSettingsTab />} />
                </Route>
                <Route path='orders' element={<OrdersPage />} />
                <Route path='wishlist' element={<WishlistPage />} />
                <Route path='compare' element={<ComparePage />} />
                <Route path='collections/:slug' element={<CollectionPage />} />
                <Route path='refer' element={<ReferAndEarnPage />} />
                <Route
                  path='payment-methods'
                  element={<PaymentMethodsPage />}
                />
                <Route path='settings' element={<SettingsPage />} />
                <Route path='download-app' element={<DownloadAppPage />} />

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
          </Suspense>
        </BrowserRouter>
      </StripeProvider>
    </QueryClientProvider>
  )
}

export default App

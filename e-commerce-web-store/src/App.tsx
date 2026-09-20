// ============================================
// TechTools E-Commerce Store - Main App
// ============================================

import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StripeProvider } from './contexts/StripeContext'
import Layout from './components/layout/Layout'
import SellerWorkspaceLayout from './components/layout/SellerWorkspaceLayout'
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
const SellerCenterShell = lazy(
  () => import('./pages/seller-center/SellerCenterShell'),
)
const CreatorOverviewTab = lazy(() => import('./pages/seller-center/OverviewTab'))
const CreatorStoreProductsTab = lazy(() => import('./pages/seller-center/StoreProductsTab'))
const CreatorBooksTab = lazy(() => import('./pages/seller-center/BooksTab'))
const CreatorDiscoverTab = lazy(() => import('./pages/seller-center/DiscoverTab'))
const CreatorPerformanceTab = lazy(() => import('./pages/seller-center/PerformanceTab'))
const CreatorEarningsTab = lazy(() => import('./pages/seller-center/EarningsTab'))
const CreatorActivityTab = lazy(() => import('./pages/seller-center/ActivityTab'))
const CreatorSettingsTab = lazy(() => import('./pages/seller-center/SettingsTab'))
const SellerComingSoonRoute = lazy(() => import('./pages/seller-center/ComingSoonRoute'))
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

// Old support-ticket notification links were baked as
// `/seller-hub/support/:id` (a path segment). The new page reads the
// ticket to preselect from a `?ticket=` query param instead, so this
// redirects the id across rather than dropping it.
function LegacyTicketRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/seller-center/support?ticket=${id}`} replace />
}

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

              {/* Seller Hub -- the thin chrome-free wrapper is still right
                  here: this page has no shell of its own. */}
              <Route element={<SellerWorkspaceLayout />}>
                <Route path='seller-hub' element={<SellerHubPage />} />
              </Route>
              <Route
                path='seller-hub/support'
                element={<Navigate to='/seller-center/support' replace />}
              />
              <Route
                path='seller-hub/support/:id'
                element={<LegacyTicketRedirect />}
              />

              {/* Seller Center -- deliberately its own top-level route,
                  outside <Layout /> AND outside SellerWorkspaceLayout:
                  SellerCenterShell is a full sidebar+topbar application
                  shell in its own right (its topbar already has its own
                  "Return to TechTools" link), so wrapping it in another
                  layout's top bar would stack two headers on every
                  Seller Center page. */}
              <Route path='seller-center' element={<SellerCenterShell />}>
                <Route index element={<Navigate to='overview' replace />} />
                <Route path='overview' element={<CreatorOverviewTab />} />
                <Route path='products' element={<CreatorStoreProductsTab />} />
                <Route path='products/books' element={<CreatorBooksTab />} />
                <Route
                  path='products/new'
                  element={<Navigate to='/seller-center/products' replace />}
                />
                <Route path='inventory' element={<SellerComingSoonRoute />} />
                <Route path='orders' element={<SellerComingSoonRoute />} />
                <Route path='returns' element={<SellerComingSoonRoute />} />
                <Route path='shipping' element={<SellerComingSoonRoute />} />
                <Route path='messages' element={<SellerComingSoonRoute />} />
                <Route path='reviews' element={<SellerComingSoonRoute />} />
                <Route path='marketing' element={<SellerComingSoonRoute />} />
                <Route path='content' element={<CreatorDiscoverTab />} />
                <Route path='analytics' element={<CreatorPerformanceTab />} />
                <Route path='finances' element={<CreatorEarningsTab />} />
                <Route path='payouts' element={<SellerComingSoonRoute />} />
                <Route path='account-health' element={<SellerComingSoonRoute />} />
                <Route path='academy' element={<SellerComingSoonRoute />} />
                <Route path='support' element={<SellerSupportPage />} />
                <Route path='activity' element={<CreatorActivityTab />} />
                <Route path='settings' element={<CreatorSettingsTab />} />
              </Route>

              {/* Old creator-dashboard URLs -- redirect to the new
                  /seller-center/* home. Anything already bookmarked or
                  baked into an old notification's actionUrl still
                  resolves; new code never generates these paths. */}
              <Route
                path='creator-dashboard'
                element={<Navigate to='/seller-center' replace />}
              />
              <Route
                path='creator-dashboard/overview'
                element={<Navigate to='/seller-center/overview' replace />}
              />
              <Route
                path='creator-dashboard/store'
                element={<Navigate to='/seller-center/products' replace />}
              />
              <Route
                path='creator-dashboard/books'
                element={<Navigate to='/seller-center/products/books' replace />}
              />
              <Route
                path='creator-dashboard/discover'
                element={<Navigate to='/seller-center/content' replace />}
              />
              <Route
                path='creator-dashboard/performance'
                element={<Navigate to='/seller-center/analytics' replace />}
              />
              <Route
                path='creator-dashboard/earnings'
                element={<Navigate to='/seller-center/finances' replace />}
              />
              <Route
                path='creator-dashboard/activity'
                element={<Navigate to='/seller-center/activity' replace />}
              />
              <Route
                path='creator-dashboard/settings'
                element={<Navigate to='/seller-center/settings' replace />}
              />

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

// ============================================
// SHEIN-Style Header/Navbar Component
// ============================================

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  User,
  Heart,
  ShoppingBag,
  Menu,
  X,
  ChevronDown,
  MapPin,
  Truck,
  Gift,
  Percent,
  Headphones,
} from 'lucide-react'
import {
  useCartStore,
  useWishlistStore,
  useAuthStore,
  useUIStore,
} from '../../stores'
import { cn } from '../../utils'
import SearchOverlay from './SearchOverlay'
import MegaMenu from './MegaMenu'
import MobileMenu from './MobileMenu'
import CartDrawer from '../cart/CartDrawer'
import { NotificationBell } from '../notifications/NotificationBell'

// Navigation Categories Data
const navigationCategories = [
  {
    id: 'new-in',
    label: 'New In',
    href: '/new-arrivals',
    featured: true,
    color: 'text-red-500',
  },
  {
    id: 'sale',
    label: 'Sale',
    href: '/sale',
    featured: true,
    color: 'text-red-600 font-bold',
  },
  {
    id: 'trending',
    label: 'Trending',
    href: '/trending',
    featured: true,
    color: 'text-orange-500 font-semibold',
  },
  {
    id: 'lighting',
    label: 'Lighting',
    href: '/category/lighting',
    megaMenu: true,
  },
  {
    id: 'audio',
    label: 'Audio & Entertainment',
    href: '/category/audio-entertainment',
    megaMenu: true,
  },
  {
    id: 'safety',
    label: 'Safety & Security',
    href: '/category/safety-security',
    megaMenu: true,
  },
  {
    id: 'tools',
    label: 'Tools & Emergency',
    href: '/category/tools-emergency',
    megaMenu: true,
  },
  {
    id: 'interior',
    label: 'Interior',
    href: '/category/interior-comfort',
    megaMenu: true,
  },
  {
    id: 'performance',
    label: 'Performance',
    href: '/category/performance-parts',
    megaMenu: true,
  },
  {
    id: 'brands',
    label: 'Brands',
    href: '/brands',
    megaMenu: true,
  },
]

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showPromoBar, setShowPromoBar] = useState(true)

  const megaMenuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { items: cartItems, isOpen: isCartOpen, toggleCart } = useCartStore()
  const { items: wishlistItems } = useWishlistStore()
  const { isAuthenticated, user } = useAuthStore()
  const { isSearchOpen, openSearch, isMobileMenuOpen, toggleMobileMenu } =
    useUIStore()

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle mega menu hover
  const handleCategoryHover = (categoryId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setActiveCategory(categoryId)
  }

  const handleCategoryLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveCategory(null)
    }, 150)
  }

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const wishlistCount = wishlistItems.length

  return (
    <>
      {/* Promo Bar */}
      {showPromoBar && (
        <div className='bg-linear-to-r from-orange-500 via-red-500 to-pink-500 text-white text-center py-2 px-4 text-sm relative'>
          <div className='flex items-center justify-center gap-2'>
            <Gift className='w-4 h-4' />
            <span className='font-medium'>
              FREE SHIPPING on orders over €50 | Use code{' '}
              <span className='font-bold'>TECH20</span> for 20% OFF
            </span>
            <Truck className='w-4 h-4' />
          </div>
          <button
            onClick={() => setShowPromoBar(false)}
            className='absolute right-4 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded p-1 transition-colors'
          >
            <X className='w-4 h-4' />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className='bg-gray-900 text-gray-300 text-xs py-2'>
        <div className='container mx-auto px-4 flex items-center justify-between'>
          <div className='flex items-center gap-6'>
            <Link
              to='/shipping'
              className='flex items-center gap-1 hover:text-white transition-colors'
            >
              <Truck className='w-3.5 h-3.5' />
              Free Shipping €50+
            </Link>
            <Link
              to='/track-order'
              className='flex items-center gap-1 hover:text-white transition-colors'
            >
              <MapPin className='w-3.5 h-3.5' />
              Track Order
            </Link>
          </div>
          <div className='flex items-center gap-6'>
            <Link
              to='/deals'
              className='flex items-center gap-1 hover:text-white transition-colors'
            >
              <Percent className='w-3.5 h-3.5' />
              Daily Deals
            </Link>
            <Link
              to='/support'
              className='flex items-center gap-1 hover:text-white transition-colors'
            >
              <Headphones className='w-3.5 h-3.5' />
              24/7 Support
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={cn(
          'sticky top-0 z-50 bg-white transition-all duration-300',
          isScrolled && 'shadow-lg',
        )}
      >
        {/* Primary Header */}
        <div className='container mx-auto px-4'>
          <div className='flex items-center justify-between h-16 lg:h-20'>
            {/* Mobile Menu Toggle */}
            <button
              onClick={toggleMobileMenu}
              className='lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors'
            >
              <Menu className='w-6 h-6' />
            </button>

            {/* Logo */}
            <Link to='/' className='flex items-center gap-1.5 sm:gap-2'>
              <div className='w-8 h-8 sm:w-10 sm:h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-lg sm:rounded-xl flex items-center justify-center'>
                <span className='text-white font-bold text-lg sm:text-xl'>
                  T
                </span>
              </div>
              <span className='text-lg sm:text-2xl font-bold bg-linear-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent'>
                TechTools
              </span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className='hidden lg:flex flex-1 max-w-2xl mx-8'>
              <div
                onClick={openSearch}
                className='w-full flex items-center bg-gray-100 hover:bg-gray-200 rounded-full px-5 py-3 cursor-pointer transition-colors group'
              >
                <Search className='w-5 h-5 text-gray-400 group-hover:text-gray-600' />
                <span className='ml-3 text-gray-500 text-sm'>
                  Search for products, brands, and more...
                </span>
                <kbd className='ml-auto hidden xl:block text-xs text-gray-400 bg-white px-2 py-1 rounded border'>
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Right Actions */}
            <div className='flex items-center gap-1 sm:gap-2'>
              {/* Search - Mobile */}
              <button
                onClick={openSearch}
                className='lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors'
              >
                <Search className='w-6 h-6' />
              </button>

              {/* Notifications */}
              <NotificationBell />

              {/* User Account */}
              <Link
                to={isAuthenticated ? '/profile' : '/login'}
                className='hidden sm:flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors'
              >
                {isAuthenticated && user ? (
                  <>
                    <div className='w-8 h-8 bg-linear-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-medium'>
                      {user.first_name?.charAt(0) ||
                        user.email?.charAt(0) ||
                        'U'}
                    </div>
                    <div className='hidden xl:block text-left'>
                      <p className='text-xs text-gray-500'>Welcome back</p>
                      <p className='text-sm font-medium'>
                        {user.first_name || 'User'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <User className='w-6 h-6' />
                    <div className='hidden xl:block text-left'>
                      <p className='text-xs text-gray-500'>Sign in</p>
                      <p className='text-sm font-medium'>Account</p>
                    </div>
                  </>
                )}
              </Link>

              {/* Wishlist */}
              <Link
                to='/wishlist'
                className='relative p-2 hover:bg-gray-100 rounded-lg transition-colors'
              >
                <Heart className='w-6 h-6' />
                {wishlistCount > 0 && (
                  <span className='absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center'>
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={toggleCart}
                className='relative p-2 hover:bg-gray-100 rounded-lg transition-colors group'
              >
                <ShoppingBag className='w-6 h-6 group-hover:scale-110 transition-transform' />
                {cartItemCount > 0 && (
                  <span className='absolute -top-0.5 -right-0.5 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse'>
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Category Navigation - Desktop */}
        <nav className='hidden lg:block border-t border-gray-100 bg-white'>
          <div className='container mx-auto px-4'>
            <ul className='flex items-center gap-1'>
              {/* Categories Button */}
              <li
                className='relative'
                onMouseEnter={() => handleCategoryHover('all-categories')}
                onMouseLeave={handleCategoryLeave}
              >
                <button className='flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-t-lg font-medium hover:bg-gray-800 transition-colors'>
                  <Menu className='w-4 h-4' />
                  <span>Categories</span>
                  <ChevronDown className='w-4 h-4' />
                </button>
              </li>

              {/* Navigation Links */}
              {navigationCategories.map((category) => (
                <li
                  key={category.id}
                  className='relative'
                  onMouseEnter={() =>
                    category.megaMenu && handleCategoryHover(category.id)
                  }
                  onMouseLeave={handleCategoryLeave}
                >
                  <Link
                    to={category.href}
                    className={cn(
                      'flex items-center gap-1 px-4 py-3 text-sm font-medium transition-colors',
                      category.color || 'text-gray-700 hover:text-orange-600',
                      activeCategory === category.id && 'text-orange-600',
                    )}
                  >
                    {category.label}
                    {category.megaMenu && (
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 transition-transform',
                          activeCategory === category.id && 'rotate-180',
                        )}
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Mega Menu */}
        {activeCategory && (
          <div
            ref={megaMenuRef}
            onMouseEnter={() => handleCategoryHover(activeCategory)}
            onMouseLeave={handleCategoryLeave}
            className='absolute left-0 right-0 bg-white border-t border-gray-100 shadow-2xl animate-fade-in z-40'
          >
            <MegaMenu categoryId={activeCategory} />
          </div>
        )}
      </header>

      {/* Search Overlay */}
      {isSearchOpen && <SearchOverlay />}

      {/* Mobile Menu */}
      {isMobileMenuOpen && <MobileMenu categories={navigationCategories} />}

      {/* Cart Drawer */}
      {isCartOpen && <CartDrawer />}
    </>
  )
}

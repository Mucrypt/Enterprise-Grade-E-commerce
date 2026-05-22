// ============================================
// Profile Page - User Account Management
// ============================================

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Check,
  AlertCircle,
  Loader,
  Package,
  Heart,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  LifeBuoy,
  HelpCircle,
  MessageCircle,
  Star,
  Store,
} from 'lucide-react'
import { supportApi } from '../api'
import { SupportConcierge } from '../components/layout/SupportConcierge'
import { useAuthStore } from '../stores'
import { cn } from '../utils'

type TabType = 'profile' | 'addresses' | 'security' | 'notifications'

export default function ProfilePage() {
  const navigate = useNavigate()
  const {
    user,
    isAuthenticated,
    logout,
    updateUser,
    isLoading: authLoading,
    hasHydrated,
  } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const { data: supportProfile } = useQuery({
    queryKey: ['support-profile', user?.id],
    queryFn: () => supportApi.getProfile(),
    enabled: hasHydrated && isAuthenticated,
    retry: false,
  })

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      navigate('/login', { state: { from: { pathname: '/profile' } } })
    }
  }, [isAuthenticated, authLoading, hasHydrated, navigate])

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // Update local state (API call would go here in production)
      updateUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      })
      setSuccess('Profile updated successfully!')
      setIsEditing(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (authLoading || !hasHydrated) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <Loader className='w-8 h-8 animate-spin text-orange-500' />
      </div>
    )
  }

  if (!user) return null

  const sidebarItems = [
    { id: 'profile', label: 'Personal Info', icon: User },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'security', label: 'Password & Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  const quickLinks = [
    { label: 'My Orders', icon: Package, href: '/orders', count: 5 },
    { label: 'Wishlist', icon: Heart, href: '/wishlist', count: 12 },
    { label: 'Track Order', icon: Package, href: '/track-order' },
    { label: 'Returns', icon: MessageCircle, href: '/returns' },
    { label: 'Payment Methods', icon: CreditCard, href: '/payment-methods' },
    { label: 'Seller Hub', icon: Store, href: '/seller-hub' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ]

  const supportLinks = [
    {
      label: 'Smart Support',
      icon: LifeBuoy,
      href: '/contact?subject=technical&message=I%20want%20live%20support.',
    },
    { label: 'Help Center', icon: HelpCircle, href: '/faq' },
    { label: 'Contact Us', icon: MessageCircle, href: '/contact' },
    {
      label: 'Rate the App',
      icon: Star,
      href: '/contact?subject=feedback&message=I%20want%20to%20rate%20the%20app.',
    },
  ]

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-6xl mx-auto px-4'>
        {/* Profile Header */}
        <div className='bg-white rounded-2xl shadow-sm p-6 mb-6'>
          <div className='flex flex-col sm:flex-row items-start sm:items-center gap-6'>
            <div className='relative'>
              <div className='w-24 h-24 bg-linear-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center'>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.first_name}
                    className='w-full h-full rounded-full object-cover'
                  />
                ) : (
                  <span className='text-3xl font-bold text-white'>
                    {user.first_name?.[0]?.toUpperCase() ||
                      user.email[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <button className='absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors'>
                <Camera className='w-4 h-4 text-gray-600' />
              </button>
            </div>
            <div className='flex-1'>
              <h1 className='text-2xl font-bold text-gray-900'>
                {user.first_name || ''} {user.last_name || ''}
              </h1>
              <p className='text-gray-500'>{user.email}</p>
              <p className='text-sm text-orange-500 mt-1'>
                Member since Jan 2024
              </p>
            </div>
            <button
              onClick={handleLogout}
              className='flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors'
            >
              <LogOut className='w-4 h-4' />
              Sign Out
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Sidebar */}
          <div className='lg:col-span-1'>
            <div className='bg-white rounded-2xl shadow-sm p-4 mb-6'>
              <h3 className='font-semibold text-gray-900 px-3 mb-2'>
                Account Settings
              </h3>
              <nav className='space-y-1'>
                {sidebarItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      activeTab === item.id
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-600 hover:bg-gray-100',
                    )}
                  >
                    <item.icon className='w-5 h-5' />
                    <span className='font-medium'>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className='bg-white rounded-2xl shadow-sm p-4'>
              <h3 className='font-semibold text-gray-900 px-3 mb-2'>
                Quick Links
              </h3>
              <nav className='space-y-1'>
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className='flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <item.icon className='w-5 h-5' />
                      <span className='font-medium'>{item.label}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      {item.count && (
                        <span className='px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full'>
                          {item.count}
                        </span>
                      )}
                      <ChevronRight className='w-4 h-4' />
                    </div>
                  </Link>
                ))}
              </nav>
            </div>

            <div className='bg-white rounded-2xl shadow-sm p-4 mt-6'>
              <h3 className='font-semibold text-gray-900 px-3 mb-2'>Support</h3>
              <nav className='space-y-1'>
                {supportLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className='flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <item.icon className='w-5 h-5' />
                      <span className='font-medium'>{item.label}</span>
                    </div>
                    <ChevronRight className='w-4 h-4' />
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className='lg:col-span-3'>
            {/* Success/Error Messages */}
            {success && (
              <div className='mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3'>
                <Check className='w-5 h-5 text-green-500' />
                <p className='text-sm text-green-600'>{success}</p>
              </div>
            )}
            {error && (
              <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3'>
                <AlertCircle className='w-5 h-5 text-red-500' />
                <p className='text-sm text-red-600'>{error}</p>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className='bg-white rounded-2xl shadow-sm p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Personal Information
                  </h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className='px-4 py-2 text-orange-500 hover:bg-orange-50 rounded-lg font-medium transition-colors'
                    >
                      Edit
                    </button>
                  ) : (
                    <div className='flex gap-2'>
                      <button
                        onClick={() => setIsEditing(false)}
                        className='px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors'
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className='px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2'
                      >
                        {isSaving && (
                          <Loader className='w-4 h-4 animate-spin' />
                        )}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      First Name
                    </label>
                    <div className='relative'>
                      <User className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <input
                        type='text'
                        value={formData.first_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            first_name: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        className={cn(
                          'w-full pl-12 pr-4 py-3 border rounded-xl transition-all',
                          isEditing
                            ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500'
                            : 'bg-gray-50 border-gray-200 cursor-not-allowed',
                        )}
                      />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Last Name
                    </label>
                    <div className='relative'>
                      <User className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <input
                        type='text'
                        value={formData.last_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            last_name: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        className={cn(
                          'w-full pl-12 pr-4 py-3 border rounded-xl transition-all',
                          isEditing
                            ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500'
                            : 'bg-gray-50 border-gray-200 cursor-not-allowed',
                        )}
                      />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Email Address
                    </label>
                    <div className='relative'>
                      <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <input
                        type='email'
                        value={formData.email}
                        disabled
                        className='w-full pl-12 pr-4 py-3 border border-gray-200 bg-gray-50 rounded-xl cursor-not-allowed'
                      />
                    </div>
                    <p className='text-xs text-gray-500 mt-1'>
                      Email cannot be changed. Contact support for assistance.
                    </p>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Phone Number
                    </label>
                    <div className='relative'>
                      <Phone className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                      <input
                        type='tel'
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder={
                          isEditing ? 'Add phone number' : 'Not provided'
                        }
                        className={cn(
                          'w-full pl-12 pr-4 py-3 border rounded-xl transition-all',
                          isEditing
                            ? 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500'
                            : 'bg-gray-50 border-gray-200 cursor-not-allowed',
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className='bg-white rounded-2xl shadow-sm p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Saved Addresses
                  </h2>
                  <button className='px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors'>
                    Add Address
                  </button>
                </div>

                <div className='text-center py-12'>
                  <MapPin className='w-16 h-16 text-gray-300 mx-auto mb-4' />
                  <h3 className='text-lg font-medium text-gray-900 mb-2'>
                    No addresses saved
                  </h3>
                  <p className='text-gray-500 mb-4'>
                    Add a shipping address for faster checkout
                  </p>
                  <button className='px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors'>
                    Add Your First Address
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className='space-y-6'>
                <div className='bg-white rounded-2xl shadow-sm p-6'>
                  <h2 className='text-xl font-bold text-gray-900 mb-6'>
                    Password
                  </h2>
                  <div className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'>
                    <div>
                      <p className='font-medium text-gray-900'>Password</p>
                      <p className='text-sm text-gray-500'>
                        Last changed 3 months ago
                      </p>
                    </div>
                    <button className='px-4 py-2 text-orange-500 hover:bg-orange-50 rounded-lg font-medium transition-colors'>
                      Change Password
                    </button>
                  </div>
                </div>

                <div className='bg-white rounded-2xl shadow-sm p-6'>
                  <h2 className='text-xl font-bold text-gray-900 mb-6'>
                    Two-Factor Authentication
                  </h2>
                  <div className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'>
                    <div>
                      <p className='font-medium text-gray-900'>2FA Status</p>
                      <p className='text-sm text-gray-500'>
                        Add an extra layer of security
                      </p>
                    </div>
                    <button className='px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors'>
                      Enable 2FA
                    </button>
                  </div>
                </div>

                <div className='bg-white rounded-2xl shadow-sm p-6'>
                  <h2 className='text-xl font-bold text-gray-900 mb-6'>
                    Login Sessions
                  </h2>
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl'>
                      <div>
                        <p className='font-medium text-gray-900'>
                          Chrome on Windows
                        </p>
                        <p className='text-sm text-gray-500'>
                          Current session • Vilnius, Lithuania
                        </p>
                      </div>
                      <span className='px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full'>
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className='bg-white rounded-2xl shadow-sm p-6'>
                <h2 className='text-xl font-bold text-gray-900 mb-6'>
                  Notification Preferences
                </h2>
                <div className='space-y-4'>
                  {[
                    {
                      label: 'Order updates',
                      description: 'Get notified about shipping and delivery',
                      enabled: true,
                    },
                    {
                      label: 'Promotions',
                      description: 'Receive exclusive deals and offers',
                      enabled: true,
                    },
                    {
                      label: 'Product alerts',
                      description: 'Wishlist items back in stock or on sale',
                      enabled: false,
                    },
                    {
                      label: 'Newsletter',
                      description: 'Weekly tips and new product announcements',
                      enabled: false,
                    },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'
                    >
                      <div>
                        <p className='font-medium text-gray-900'>
                          {item.label}
                        </p>
                        <p className='text-sm text-gray-500'>
                          {item.description}
                        </p>
                      </div>
                      <button
                        className={cn(
                          'w-12 h-6 rounded-full transition-colors relative',
                          item.enabled ? 'bg-orange-500' : 'bg-gray-300',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                            item.enabled ? 'right-1' : 'left-1',
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SupportConcierge user={user} supportProfile={supportProfile || null} />
    </div>
  )
}

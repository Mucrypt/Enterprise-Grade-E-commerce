// ============================================
// Contact Us Page - Production Ready
// ============================================

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageSquare,
  Send,
  CheckCircle,
  Headphones,
  Package,
  CreditCard,
  RotateCcw,
  AlertCircle,
  Copy,
  Lock,
} from 'lucide-react'
import { useAuthStore } from '../stores'

const API_URL =
  import.meta.env.VITE_API_URL || 'https://techtoolstore.com/api/v1'

// Fire-and-forget: no await, never surfaces errors to the user
const trackContactEvent = (
  event_type: 'guest_contact_cta_click' | 'protected_contact_login_redirect',
  subject?: string,
) => {
  axios
    .post(`${API_URL}/contact/analytics`, { event_type, subject })
    .catch(() => {/* silent */})
}

const contactMethods = [
  {
    icon: Phone,
    title: 'Phone Support',
    description: 'Speak directly with our support team',
    contact: '+27 12 345 6789',
    availability: 'Mon-Fri: 9AM-6PM SAST',
    action: 'tel:+27123456789',
    actionLabel: 'Call Now',
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Get a response within 24 hours',
    contact: 'support@techtoolstore.com',
    availability: '24/7 Support',
    action: 'mailto:support@techtoolstore.com',
    actionLabel: 'Send Email',
  },
  {
    icon: MessageSquare,
    title: 'Live Chat',
    description: 'Chat with us in real-time',
    contact: 'Available on website',
    availability: 'Mon-Sat: 8AM-10PM SAST',
    action: '#',
    actionLabel: 'Start Chat',
  },
]

const departments = [
  {
    icon: Headphones,
    name: 'General Support',
    email: 'support@techtoolstore.com',
    description: 'For general inquiries and assistance',
  },
  {
    icon: Package,
    name: 'Order Support',
    email: 'orders@techtoolstore.com',
    description: 'Questions about orders and shipping',
  },
  {
    icon: CreditCard,
    name: 'Billing & Payments',
    email: 'billing@techtoolstore.com',
    description: 'Payment issues and invoice requests',
  },
  {
    icon: RotateCcw,
    name: 'Returns & Refunds',
    email: 'returns@techtoolstore.com',
    description: 'Return requests and refund inquiries',
  },
]

const officeLocations = [
  {
    city: 'Johannesburg',
    country: 'South Africa (Headquarters)',
    address: '123 Tech Street, Sandton, Johannesburg 2196',
    phone: '+27 11 234 5678',
    email: 'info@techtoolstore.com',
  },
  {
    city: 'Cape Town',
    country: 'South Africa',
    address: '456 Commerce Lane, V&A Waterfront, Cape Town 8001',
    phone: '+27 21 123 4567',
    email: 'capetown@techtoolstore.com',
  },
  {
    city: 'Durban',
    country: 'South Africa',
    address: '78 Marine Parade, Durban 4001',
    phone: '+27 31 987 6543',
    email: 'durban@techtoolstore.com',
  },
]

const protectedSubjects = new Set(['order', 'shipping', 'return', 'billing'])

const subjectOptions = [
  { value: 'order', label: 'Order Inquiry', requiresAccount: true },
  { value: 'shipping', label: 'Shipping Question', requiresAccount: true },
  { value: 'return', label: 'Return/Refund Request', requiresAccount: true },
  { value: 'product', label: 'Product Question', requiresAccount: false },
  { value: 'billing', label: 'Billing Issue', requiresAccount: true },
  { value: 'technical', label: 'Technical Support', requiresAccount: false },
  { value: 'feedback', label: 'Feedback/Suggestion', requiresAccount: false },
  { value: 'other', label: 'Other', requiresAccount: false },
]

export default function ContactPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, hasHydrated } = useAuthStore()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    orderNumber: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [ticketNumber, setTicketNumber] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const selectedSubjectRequiresAccount = useMemo(
    () => protectedSubjects.has(formData.subject),
    [formData.subject],
  )

  useEffect(() => {
    const subject = searchParams.get('subject') || ''
    const orderNumber = searchParams.get('orderNumber') || ''
    const message = searchParams.get('message') || ''

    if (!subject && !orderNumber && !message) {
      return
    }

    setFormData((prev) => ({
      ...prev,
      subject: subject || prev.subject,
      orderNumber: orderNumber || prev.orderNumber,
      message: message || prev.message,
    }))
  }, [searchParams])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) {
      return
    }

    setFormData((prev) => ({
      ...prev,
      name:
        prev.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || '',
    }))
  }, [hasHydrated, isAuthenticated, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedSubjectRequiresAccount && !isAuthenticated) {
      trackContactEvent('protected_contact_login_redirect', formData.subject)
      navigate('/login', {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
          },
          reason: 'contact-support-auth',
        },
      })
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('auth_token')
      const response = await axios.post(`${API_URL}/contact`, formData, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      })

      if (response.data.success) {
        setTicketNumber(response.data.ticketNumber)
        setIsSubmitted(true)
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          orderNumber: '',
          message: '',
        })
      } else {
        setError(response.data.error || 'Failed to send message')
      }
    } catch (err: any) {
      if (err.response?.data?.code === 'AUTH_REQUIRED_FOR_PROTECTED_CONTACT') {
        navigate('/login', {
          state: {
            from: {
              pathname: location.pathname,
              search: location.search,
            },
            reason: 'contact-support-auth',
          },
        })
        return
      }

      setError(
        err.response?.data?.error ||
          'Unable to send your message. Please try again or email us directly.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyTicketNumber = () => {
    navigator.clipboard.writeText(ticketNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <div className='bg-linear-to-br from-orange-500 via-red-500 to-pink-500 text-white'>
        <div className='container mx-auto px-4 py-16'>
          <div className='max-w-4xl mx-auto text-center'>
            <div className='w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6'>
              <Headphones className='w-8 h-8 text-white' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Contact Us</h1>
            <p className='text-white/90 text-lg max-w-2xl mx-auto'>
              We're here to help! Reach out to our friendly support team and
              we'll get back to you as soon as possible.
            </p>
            <div className='mt-6 max-w-3xl mx-auto rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-left backdrop-blur-sm'>
              <p className='inline-flex items-center gap-2 text-sm font-semibold text-white'>
                <Lock className='h-4 w-4' />
                Support access policy
              </p>
              <p className='mt-1 text-sm text-white/90'>
                General and product questions can be sent without an account.
                Order, shipping, return, and billing support requires sign-in
                to protect customer data.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Methods */}
      <div className='container mx-auto px-4 -mt-8'>
        <div className='grid md:grid-cols-3 gap-6 max-w-5xl mx-auto'>
          {contactMethods.map((method) => (
            <div
              key={method.title}
              className='bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow'
            >
              <div className='w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4'>
                <method.icon className='w-6 h-6 text-orange-600' />
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>
                {method.title}
              </h3>
              <p className='text-sm text-gray-500 mb-3'>{method.description}</p>
              <p className='font-medium text-gray-900 mb-1'>{method.contact}</p>
              <p className='text-xs text-gray-500 mb-4'>
                {method.availability}
              </p>
              <a
                href={method.action}
                className='inline-flex items-center gap-2 text-orange-600 font-medium hover:text-orange-700 transition-colors'
              >
                {method.actionLabel}
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 5l7 7-7 7'
                  />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-6xl mx-auto'>
          <div className='grid lg:grid-cols-5 gap-12'>
            {/* Contact Form */}
            <div className='lg:col-span-3'>
              <div className='bg-white rounded-2xl p-8 shadow-sm'>
                <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                  Send Us a Message
                </h2>
                <p className='text-gray-600 mb-6'>
                  General questions stay open for guests. Order, shipping,
                  returns, and billing support require a signed-in account so we
                  can protect customer data.
                </p>

                {isSubmitted ? (
                  <div className='text-center py-12'>
                    <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                      <CheckCircle className='w-8 h-8 text-green-600' />
                    </div>
                    <h3 className='text-xl font-semibold text-gray-900 mb-2'>
                      Message Sent!
                    </h3>
                    <p className='text-gray-600 mb-4'>
                      Thank you for reaching out. We'll respond to your inquiry
                      within 24 hours.
                    </p>
                    {ticketNumber && (
                      <div className='bg-orange-50 rounded-xl p-4 mb-6 max-w-xs mx-auto'>
                        <p className='text-xs text-gray-500 mb-1'>
                          Your Ticket Number
                        </p>
                        <div className='flex items-center justify-center gap-2'>
                          <span className='font-mono text-lg font-bold text-orange-600'>
                            {ticketNumber}
                          </span>
                          <button
                            onClick={copyTicketNumber}
                            className='p-1 hover:bg-orange-100 rounded transition-colors'
                            title='Copy ticket number'
                          >
                            <Copy
                              className={`w-4 h-4 ${
                                copied ? 'text-green-600' : 'text-gray-400'
                              }`}
                            />
                          </button>
                        </div>
                        {copied && (
                          <p className='text-xs text-green-600 mt-1'>Copied!</p>
                        )}
                      </div>
                    )}
                    <p className='text-sm text-gray-500 mb-6'>
                      Check your email for a confirmation with your ticket
                      details.
                    </p>
                    <button
                      onClick={() => {
                        setIsSubmitted(false)
                        setTicketNumber('')
                      }}
                      className='text-orange-600 font-medium hover:text-orange-700'
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className='space-y-6'>
                    {/* Error Display */}
                    {error && (
                      <div className='flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg'>
                        <AlertCircle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />
                        <div>
                          <p className='text-sm font-medium text-red-800'>
                            {error}
                          </p>
                          <p className='text-xs text-red-600 mt-1'>
                            You can also email us directly at{' '}
                            <a
                              href='mailto:support@techtoolstore.com'
                              className='underline'
                            >
                              support@techtoolstore.com
                            </a>
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedSubjectRequiresAccount && !isAuthenticated && (
                      <div className='flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg'>
                        <Lock className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
                        <div>
                          <p className='text-sm font-medium text-amber-900'>
                            This support category requires an account
                          </p>
                          <p className='text-sm text-amber-700 mt-1'>
                            Sign in to contact us about orders, shipping,
                            returns, or billing. General and pre-sales questions
                            can still be sent without an account.
                          </p>
                          <div className='flex flex-wrap gap-3 mt-3'>
                            <Link
                              to='/login'
                              state={{
                                from: {
                                  pathname: location.pathname,
                                  search: location.search,
                                },
                                reason: 'contact-support-auth',
                              }}
                              onClick={() =>
                                trackContactEvent(
                                  'protected_contact_login_redirect',
                                  formData.subject,
                                )
                              }
                              className='inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors'
                            >
                              Sign In
                            </Link>
                            <Link
                              to='/register'
                              state={{
                                from: {
                                  pathname: location.pathname,
                                  search: location.search,
                                },
                              }}
                              className='inline-flex items-center justify-center rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors'
                            >
                              Create Account
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className='grid md:grid-cols-2 gap-6'>
                      <div>
                        <label
                          htmlFor='name'
                          className='block text-sm font-medium text-gray-700 mb-2'
                        >
                          Full Name *
                        </label>
                        <input
                          type='text'
                          id='name'
                          name='name'
                          value={formData.name}
                          onChange={handleChange}
                          required
                          disabled={
                            selectedSubjectRequiresAccount && isAuthenticated
                          }
                          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors'
                          placeholder='John Doe'
                        />
                        {selectedSubjectRequiresAccount && isAuthenticated && (
                          <p className='mt-2 text-xs text-gray-500'>
                            Using your signed-in account identity for protected
                            support.
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor='email'
                          className='block text-sm font-medium text-gray-700 mb-2'
                        >
                          Email Address *
                        </label>
                        <input
                          type='email'
                          id='email'
                          name='email'
                          value={formData.email}
                          onChange={handleChange}
                          required
                          disabled={
                            selectedSubjectRequiresAccount && isAuthenticated
                          }
                          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors'
                          placeholder='john@example.com'
                        />
                      </div>
                    </div>

                    <div className='grid md:grid-cols-2 gap-6'>
                      <div>
                        <label
                          htmlFor='phone'
                          className='block text-sm font-medium text-gray-700 mb-2'
                        >
                          Phone Number
                        </label>
                        <input
                          type='tel'
                          id='phone'
                          name='phone'
                          value={formData.phone}
                          onChange={handleChange}
                          disabled={
                            selectedSubjectRequiresAccount &&
                            isAuthenticated &&
                            Boolean(user?.phone)
                          }
                          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors'
                          placeholder='+1 (234) 567-890'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='orderNumber'
                          className='block text-sm font-medium text-gray-700 mb-2'
                        >
                          Order Number (if applicable)
                        </label>
                        <input
                          type='text'
                          id='orderNumber'
                          name='orderNumber'
                          value={formData.orderNumber}
                          onChange={handleChange}
                          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors'
                          placeholder='TT-123456'
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor='subject'
                        className='block text-sm font-medium text-gray-700 mb-2'
                      >
                        Subject *
                      </label>
                      <select
                        id='subject'
                        name='subject'
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors'
                      >
                        <option value=''>Select a subject</option>
                        {subjectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                            {option.requiresAccount
                              ? ' (Account Required)'
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor='message'
                        className='block text-sm font-medium text-gray-700 mb-2'
                      >
                        Message *
                      </label>
                      <textarea
                        id='message'
                        name='message'
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={5}
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none'
                        placeholder='How can we help you?'
                      />
                    </div>

                    <button
                      type='submit'
                      disabled={isSubmitting}
                      className='w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:bg-orange-300 transition-colors'
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className='animate-spin w-5 h-5'
                            fill='none'
                            viewBox='0 0 24 24'
                          >
                            <circle
                              className='opacity-25'
                              cx='12'
                              cy='12'
                              r='10'
                              stroke='currentColor'
                              strokeWidth='4'
                            />
                            <path
                              className='opacity-75'
                              fill='currentColor'
                              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                            />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className='w-5 h-5' />
                          {selectedSubjectRequiresAccount && !isAuthenticated
                            ? 'Sign In to Continue'
                            : 'Send Message'}
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className='lg:col-span-2 space-y-6'>
              {/* Departments */}
              <div className='bg-white rounded-2xl p-6 shadow-sm'>
                <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                  Contact by Department
                </h3>
                <div className='space-y-4'>
                  {departments.map((dept) => (
                    <div key={dept.name} className='flex items-start gap-3'>
                      <div className='w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0'>
                        <dept.icon className='w-5 h-5 text-gray-600' />
                      </div>
                      <div>
                        <h4 className='font-medium text-gray-900'>
                          {dept.name}
                        </h4>
                        <p className='text-sm text-gray-500'>
                          {dept.description}
                        </p>
                        <a
                          href={`mailto:${dept.email}`}
                          className='text-sm text-orange-600 hover:underline'
                        >
                          {dept.email}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business Hours */}
              <div className='bg-white rounded-2xl p-6 shadow-sm'>
                <div className='flex items-center gap-3 mb-4'>
                  <Clock className='w-5 h-5 text-orange-600' />
                  <h3 className='text-lg font-semibold text-gray-900'>
                    Business Hours
                  </h3>
                </div>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Monday - Friday</span>
                    <span className='font-medium text-gray-900'>
                      9:00 AM - 6:00 PM EST
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Saturday</span>
                    <span className='font-medium text-gray-900'>
                      10:00 AM - 4:00 PM EST
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Sunday</span>
                    <span className='font-medium text-gray-500'>Closed</span>
                  </div>
                </div>
                <div className='mt-4 pt-4 border-t border-gray-100'>
                  <p className='text-xs text-gray-500'>
                    * Email support is available 24/7. We aim to respond within
                    24 hours.
                  </p>
                </div>
              </div>

              {/* Social Media */}
              <div className='bg-white rounded-2xl p-6 shadow-sm'>
                <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                  Follow Us
                </h3>
                <div className='flex gap-3'>
                  <a
                    href='https://facebook.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M18.77,7.46H14.5v-1.9c0-.9.6-1.1,1-1.1h3V.5h-4.33C10.24.5,9.5,3.44,9.5,5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4Z' />
                    </svg>
                  </a>
                  <a
                    href='https://twitter.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-sky-100 hover:text-sky-600 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' />
                    </svg>
                  </a>
                  <a
                    href='https://instagram.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-pink-100 hover:text-pink-600 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' />
                    </svg>
                  </a>
                  <a
                    href='https://youtube.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors'
                  >
                    <svg
                      className='w-5 h-5'
                      fill='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Office Locations */}
      <div className='bg-gray-100 py-16'>
        <div className='container mx-auto px-4'>
          <div className='max-w-6xl mx-auto'>
            <div className='text-center mb-10'>
              <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                Our Offices
              </h2>
              <p className='text-gray-600'>
                Visit us at one of our global locations
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-6'>
              {officeLocations.map((office) => (
                <div
                  key={office.city}
                  className='bg-white rounded-2xl p-6 shadow-sm'
                >
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center'>
                      <MapPin className='w-5 h-5 text-orange-600' />
                    </div>
                    <div>
                      <h3 className='font-semibold text-gray-900'>
                        {office.city}
                      </h3>
                      <p className='text-sm text-gray-500'>{office.country}</p>
                    </div>
                  </div>
                  <div className='space-y-2 text-sm text-gray-600'>
                    <p>{office.address}</p>
                    <p>
                      <a
                        href={`tel:${office.phone.replace(/\s/g, '')}`}
                        className='hover:text-orange-600'
                      >
                        {office.phone}
                      </a>
                    </p>
                    <p>
                      <a
                        href={`mailto:${office.email}`}
                        className='text-orange-600 hover:underline'
                      >
                        {office.email}
                      </a>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FAQ CTA */}
      <div className='container mx-auto px-4 py-16'>
        <div className='max-w-4xl mx-auto text-center'>
          <h2 className='text-2xl font-bold text-gray-900 mb-4'>
            Looking for Quick Answers?
          </h2>
          <p className='text-gray-600 mb-6'>
            Check out our FAQ section for instant answers to common questions.
          </p>
          <div className='mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left'>
            <p className='inline-flex items-center gap-2 text-sm font-semibold text-amber-900'>
              <Lock className='h-4 w-4' />
              Contact support policy
            </p>
            <p className='mt-1 text-sm text-amber-800'>
              Guest contact is available for general and product questions.
              Sign in first for order, shipping, return, and billing support.
            </p>
          </div>
          <div className='mb-6 flex flex-col sm:flex-row items-center justify-center gap-3'>
            <Link
              to='/contact?subject=other&message=I%20need%20general%20support.'
              onClick={() => trackContactEvent('guest_contact_cta_click')}
              className='inline-flex items-center gap-2 px-5 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors'
            >
              Contact General Support
            </Link>
            <Link
              to='/login'
              state={{
                from: {
                  pathname: location.pathname,
                  search:
                    '?subject=order&message=I%20need%20help%20with%20my%20order.',
                },
                reason: 'contact-support-auth',
              }}
              onClick={() =>
                trackContactEvent('protected_contact_login_redirect', 'order')
              }
              className='inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors'
            >
              Sign In for Order or Billing Help
            </Link>
          </div>
          <a
            href='/faq'
            className='inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors'
          >
            Browse FAQs
            <svg
              className='w-4 h-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M17 8l4 4m0 0l-4 4m4-4H3'
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

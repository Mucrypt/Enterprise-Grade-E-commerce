// ============================================
// Register Page - SHEIN/Amazon Style
// ============================================

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  ArrowRight,
  Check,
} from 'lucide-react'
import { useAuthStore } from '../stores'
import { cn } from '../utils'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading } = useAuthStore()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptMarketing, setAcceptMarketing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({})

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(formData.password) },
    { label: 'One number', met: /\d/.test(formData.password) },
  ]

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (!acceptTerms) {
      errors.terms = 'You must accept the terms and conditions'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      })
      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.',
      )
    }
  }

  return (
    <div className='min-h-screen bg-linear-to-br from-orange-50 to-red-50 py-12 px-4'>
      <div className='w-full max-w-lg mx-auto'>
        {/* Logo */}
        <div className='text-center mb-8'>
          <Link to='/' className='inline-flex items-center gap-2'>
            <div className='w-12 h-12 bg-linear-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center'>
              <span className='text-2xl font-black text-white'>T</span>
            </div>
            <span className='text-2xl font-black bg-linear-to-r from-orange-500 to-red-500 bg-clip-text text-transparent'>
              TechTools
            </span>
          </Link>
        </div>

        {/* Register Card */}
        <div className='bg-white rounded-2xl shadow-xl p-8'>
          <h1 className='text-2xl font-bold text-gray-900 text-center mb-2'>
            Create Account
          </h1>
          <p className='text-gray-500 text-center mb-8'>
            Join us and start shopping today
          </p>

          {/* Error Alert */}
          {error && (
            <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3'>
              <AlertCircle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />
              <p className='text-sm text-red-600'>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-5'>
            {/* Name Row */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  First Name
                </label>
                <div className='relative'>
                  <User className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                  <input
                    type='text'
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    placeholder='John'
                    autoComplete='given-name'
                    className={cn(
                      'w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all',
                      validationErrors.firstName
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-orange-200 focus:border-orange-500',
                    )}
                  />
                </div>
                {validationErrors.firstName && (
                  <p className='mt-1 text-sm text-red-500'>
                    {validationErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Last Name
                </label>
                <div className='relative'>
                  <User className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                  <input
                    type='text'
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    placeholder='Doe'
                    autoComplete='family-name'
                    className={cn(
                      'w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all',
                      validationErrors.lastName
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-orange-200 focus:border-orange-500',
                    )}
                  />
                </div>
                {validationErrors.lastName && (
                  <p className='mt-1 text-sm text-red-500'>
                    {validationErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Email Address
              </label>
              <div className='relative'>
                <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='email'
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder='john@example.com'
                  autoComplete='email'
                  className={cn(
                    'w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all',
                    validationErrors.email
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-gray-300 focus:ring-orange-200 focus:border-orange-500',
                  )}
                />
              </div>
              {validationErrors.email && (
                <p className='mt-1 text-sm text-red-500'>
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Phone (Optional) */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Phone Number <span className='text-gray-400'>(Optional)</span>
              </label>
              <div className='relative'>
                <Phone className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='tel'
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder='+370 600 00000'
                  autoComplete='tel'
                  className='w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all'
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Password
              </label>
              <div className='relative'>
                <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder='Create a strong password'
                  autoComplete='new-password'
                  className={cn(
                    'w-full pl-12 pr-12 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all',
                    validationErrors.password
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-gray-300 focus:ring-orange-200 focus:border-orange-500',
                  )}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                >
                  {showPassword ? (
                    <EyeOff className='w-5 h-5' />
                  ) : (
                    <Eye className='w-5 h-5' />
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <p className='mt-1 text-sm text-red-500'>
                  {validationErrors.password}
                </p>
              )}
              {/* Password Requirements */}
              {formData.password && (
                <div className='mt-3 grid grid-cols-2 gap-2'>
                  {passwordRequirements.map((req, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center gap-2 text-xs',
                        req.met ? 'text-green-600' : 'text-gray-400',
                      )}
                    >
                      <Check
                        className={cn(
                          'w-3 h-3',
                          req.met ? 'text-green-500' : 'text-gray-300',
                        )}
                      />
                      {req.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Confirm Password
              </label>
              <div className='relative'>
                <Lock className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleChange('confirmPassword', e.target.value)
                  }
                  placeholder='Confirm your password'
                  autoComplete='new-password'
                  className={cn(
                    'w-full pl-12 pr-12 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all',
                    validationErrors.confirmPassword
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-gray-300 focus:ring-orange-200 focus:border-orange-500',
                  )}
                />
                <button
                  type='button'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className='absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                >
                  {showConfirmPassword ? (
                    <EyeOff className='w-5 h-5' />
                  ) : (
                    <Eye className='w-5 h-5' />
                  )}
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <p className='mt-1 text-sm text-red-500'>
                  {validationErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms */}
            <div className='space-y-3'>
              <label className='flex items-start gap-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={acceptTerms}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked)
                    if (validationErrors.terms) {
                      setValidationErrors((prev) => ({ ...prev, terms: '' }))
                    }
                  }}
                  className='w-4 h-4 mt-0.5 text-orange-500 border-gray-300 rounded focus:ring-orange-500'
                />
                <span className='text-sm text-gray-600'>
                  I agree to the{' '}
                  <Link to='/terms' className='text-orange-500 hover:underline'>
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    to='/privacy'
                    className='text-orange-500 hover:underline'
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {validationErrors.terms && (
                <p className='text-sm text-red-500'>{validationErrors.terms}</p>
              )}
              <label className='flex items-start gap-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={acceptMarketing}
                  onChange={(e) => setAcceptMarketing(e.target.checked)}
                  className='w-4 h-4 mt-0.5 text-orange-500 border-gray-300 rounded focus:ring-orange-500'
                />
                <span className='text-sm text-gray-600'>
                  Send me exclusive deals, offers and updates via email
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type='submit'
              disabled={isLoading}
              className='w-full py-3 bg-linear-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
            >
              {isLoading ? (
                <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : (
                <>
                  Create Account
                  <ArrowRight className='w-5 h-5' />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className='relative my-8'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-gray-200' />
            </div>
            <div className='relative flex justify-center'>
              <span className='bg-white px-4 text-sm text-gray-500'>
                or sign up with
              </span>
            </div>
          </div>

          {/* Social Login */}
          <div className='grid grid-cols-2 gap-4'>
            <button className='flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors'>
              <svg className='w-5 h-5' viewBox='0 0 24 24'>
                <path
                  fill='#4285F4'
                  d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                />
                <path
                  fill='#34A853'
                  d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                />
                <path
                  fill='#FBBC05'
                  d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                />
                <path
                  fill='#EA4335'
                  d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                />
              </svg>
              <span className='font-medium text-gray-700'>Google</span>
            </button>
            <button className='flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors'>
              <svg className='w-5 h-5' fill='#1877F2' viewBox='0 0 24 24'>
                <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' />
              </svg>
              <span className='font-medium text-gray-700'>Facebook</span>
            </button>
          </div>

          {/* Sign In Link */}
          <p className='text-center text-gray-600 mt-8'>
            Already have an account?{' '}
            <Link
              to='/login'
              className='text-orange-500 hover:text-orange-600 font-semibold'
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

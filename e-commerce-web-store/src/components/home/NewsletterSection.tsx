// ============================================
// Newsletter Section
// ============================================

import { useState } from 'react'
import { Mail, CheckCircle, Gift, Percent } from 'lucide-react'
import { cn } from '../../utils'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsLoading(false)
    setIsSubmitted(true)
    setEmail('')
  }

  return (
    <section className='py-16 bg-linear-to-r from-orange-500 via-red-500 to-pink-500 relative overflow-hidden'>
      {/* Background decorations */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-1/2 -right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl' />
        <div className='absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl' />
      </div>

      <div className='relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
        {/* Benefits */}
        <div className='flex flex-wrap justify-center gap-4 mb-8'>
          <div className='flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm'>
            <Gift className='w-4 h-4' />
            <span>Exclusive offers</span>
          </div>
          <div className='flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm'>
            <Percent className='w-4 h-4' />
            <span>10% off your first order</span>
          </div>
        </div>

        {/* Content */}
        <h2 className='text-3xl md:text-4xl font-black text-white mb-4'>
          Join Our Newsletter
        </h2>
        <p className='text-white/90 text-lg mb-8 max-w-2xl mx-auto'>
          Subscribe to get special offers, free giveaways, and
          once-in-a-lifetime deals. Be the first to know about new products!
        </p>

        {/* Form */}
        {isSubmitted ? (
          <div className='flex items-center justify-center gap-3 bg-white/20 backdrop-blur-sm rounded-full py-4 px-6 max-w-md mx-auto'>
            <CheckCircle className='w-6 h-6 text-white' />
            <span className='text-white font-semibold'>
              Thanks for subscribing! Check your email for 10% off.
            </span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className='flex flex-col sm:flex-row gap-3 max-w-md mx-auto'
          >
            <div className='relative flex-1'>
              <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='Enter your email'
                className='w-full pl-12 pr-4 py-4 rounded-full bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/30'
                required
              />
            </div>
            <button
              type='submit'
              disabled={isLoading}
              className={cn(
                'px-8 py-4 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2',
                isLoading && 'opacity-70 cursor-not-allowed',
              )}
            >
              {isLoading ? (
                <>
                  <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  Subscribing...
                </>
              ) : (
                'Subscribe'
              )}
            </button>
          </form>
        )}

        <p className='text-white/70 text-xs mt-4'>
          By subscribing you agree to our Privacy Policy. Unsubscribe at any
          time.
        </p>
      </div>
    </section>
  )
}

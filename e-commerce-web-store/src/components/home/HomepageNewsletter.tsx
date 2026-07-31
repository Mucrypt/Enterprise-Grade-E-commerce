// ============================================
// Homepage Newsletter
//
// Preserves the exact existing newsletterApi.subscribe
// integration, loading state, success state and error
// handling from the previous NewsletterSection - only the
// visual design and copy changed. No fake subscriber counts,
// no pre-checked consent boxes, no hidden subscriptions, no
// fabricated discount claim.
// ============================================

import { useState } from 'react'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '../../utils'
import { newsletterApi } from '../../api'
import { homepageConfig } from '../../config/homepage.config'

export default function HomepageNewsletter() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await newsletterApi.subscribe({
        email,
        source: homepageConfig.newsletter.source,
      })

      setIsSubmitted(true)
      setMessage(response.message || 'Thanks for subscribing!')
      setEmail('')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response
              ?.data?.error || 'Failed to subscribe. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const { heading, description, ctaLabel } = homepageConfig.newsletter

  return (
    <section aria-label='Newsletter signup' className='bg-slate-900 py-16'>
      <div className='mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8'>
        <h2 className='text-2xl font-black tracking-tight text-white sm:text-3xl'>
          {heading}
        </h2>
        <p className='mt-3 text-base text-slate-300'>{description}</p>

        {isSubmitted ? (
          <div className='mx-auto mt-8 flex max-w-md items-center justify-center gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-6 py-4'>
            <CheckCircle className='h-5 w-5 text-emerald-400' aria-hidden='true' />
            <span className='font-semibold text-white'>{message}</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className='mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row'
          >
            <label htmlFor='homepage-newsletter-email' className='sr-only'>
              Email address
            </label>
            <div className='relative flex-1'>
              <Mail
                className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400'
                aria-hidden='true'
              />
              <input
                id='homepage-newsletter-email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='Enter your email'
                className='w-full rounded-md bg-white py-3.5 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500'
                required
              />
            </div>
            <button
              type='submit'
              disabled={isLoading}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md bg-orange-500 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-600',
                isLoading && 'cursor-not-allowed opacity-70',
              )}
            >
              {isLoading ? (
                <>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' />
                  Subscribing...
                </>
              ) : (
                ctaLabel
              )}
            </button>
          </form>
        )}

        {error && (
          <div className='mt-4 flex items-center justify-center gap-2 text-sm text-red-400'>
            <AlertCircle className='h-4 w-4' aria-hidden='true' />
            <span>{error}</span>
          </div>
        )}

        <p className='mt-4 text-xs text-slate-500'>
          By subscribing you agree to our Privacy Policy. Unsubscribe at any
          time.
        </p>
      </div>
    </section>
  )
}

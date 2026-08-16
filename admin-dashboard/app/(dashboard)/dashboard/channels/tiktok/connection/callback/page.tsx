'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import channelService from '@/services/channel.service'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, XCircle } from 'lucide-react'

/**
 * The redirect target buildAuthorizeUrl() points at. The actual token
 * EXCHANGE (the security-critical step) happens entirely server-side, in
 * channel-account.controller.ts's completeChannelOAuth(); this page only
 * forwards the provider's `code`/`state` query params to that endpoint
 * and never itself sees or stores an access/refresh token -- same
 * boundary as promotions/connections/callback/page.tsx.
 *
 * Unlike the social-publishing callback, TikTok Shop's OAuth response
 * doesn't include a shop-level currency in any source consulted -- the
 * connecting staff member confirms it explicitly here before the exchange
 * completes, rather than the backend guessing one from the shop's
 * country.
 */
function ChannelOAuthCallbackPageContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'confirming' | 'submitting' | 'success' | 'error'>('confirming')
  const [message, setMessage] = useState('')
  const [marketCurrency, setMarketCurrency] = useState('EUR')

  const code = params.get('code')
  const state = params.get('state')
  const providerError = params.get('error_description') || params.get('error')

  useEffect(() => {
    if (providerError) {
      setStatus('error')
      setMessage(providerError)
    } else if (!code || !state) {
      setStatus('error')
      setMessage('Missing authorization code or state from the TikTok redirect.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = () => {
    if (!code || !state) return
    setStatus('submitting')
    channelService
      .completeOAuth(code, state, `${window.location.origin}${window.location.pathname}`, marketCurrency)
      .then((result) => {
        if (result.success) {
          setStatus('success')
        } else {
          setStatus('error')
          setMessage(result.error)
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Failed to complete the connection.')
      })
  }

  return (
    <div className='mx-auto max-w-md space-y-4 py-16 text-center'>
      {status === 'confirming' && code && state && (
        <div className='space-y-4 text-left'>
          <p className='text-center text-sm text-muted-foreground'>Almost done -- confirm this shop&apos;s currency before completing the connection.</p>
          <div>
            <Label htmlFor='market-currency'>Shop currency</Label>
            <Select value={marketCurrency} onValueChange={setMarketCurrency}>
              <SelectTrigger id='market-currency'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='EUR'>EUR</SelectItem>
                <SelectItem value='USD'>USD</SelectItem>
                <SelectItem value='GBP'>GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className='w-full' onClick={handleConfirm}>Confirm &amp; Connect</Button>
        </div>
      )}
      {status === 'submitting' && (
        <>
          <Skeleton className='mx-auto h-8 w-48' />
          <p className='text-sm text-muted-foreground'>Completing connection...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className='mx-auto h-10 w-10 text-green-600' />
          <p className='font-medium'>TikTok Shop connected.</p>
          <Button onClick={() => router.push('/dashboard/channels/tiktok/connection')}>Back to Connection</Button>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className='mx-auto h-10 w-10 text-destructive' />
          <p className='font-medium'>Connection failed</p>
          <p className='text-sm text-muted-foreground'>{message}</p>
          <Button variant='outline' onClick={() => router.push('/dashboard/channels/tiktok/connection')}>Back to Connection</Button>
        </>
      )}
    </div>
  )
}

export default function ChannelOAuthCallbackPage() {
  return (
    <RequirePagePermission permission='channels.tiktok.connections'>
      <ChannelOAuthCallbackPageContent />
    </RequirePagePermission>
  )
}

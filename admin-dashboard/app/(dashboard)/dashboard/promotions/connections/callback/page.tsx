'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle } from 'lucide-react'

/**
 * The redirect target every adapter's buildAuthorizeUrl() points at. The
 * actual token EXCHANGE (the security-critical step -- involves the
 * client_secret) happens entirely server-side, in
 * social-connection.controller.ts's completeOAuth(); this page only
 * forwards the provider's `code`/`state` query params to that endpoint
 * and never itself sees or stores an access/refresh token. No provider
 * token passes through localStorage at any point in this flow.
 */
function OAuthCallbackPageContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    const providerError = params.get('error_description') || params.get('error')

    if (providerError) {
      setStatus('error')
      setMessage(providerError)
      return
    }
    if (!code || !state) {
      setStatus('error')
      setMessage('Missing authorization code or state from the provider redirect.')
      return
    }

    apiClient
      .post<{ success: true } | { success: false; error: string }>('/promotions/connections/oauth/callback', {
        code,
        state,
        redirectUri: `${window.location.origin}${window.location.pathname}`,
      })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className='mx-auto max-w-md space-y-4 py-16 text-center'>
      {status === 'pending' && (
        <>
          <Skeleton className='mx-auto h-8 w-48' />
          <p className='text-sm text-muted-foreground'>Completing connection...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className='mx-auto h-10 w-10 text-green-600' />
          <p className='font-medium'>Account connected.</p>
          <Button onClick={() => router.push('/dashboard/promotions/connections')}>Back to Connections</Button>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className='mx-auto h-10 w-10 text-destructive' />
          <p className='font-medium'>Connection failed</p>
          <p className='text-sm text-muted-foreground'>{message}</p>
          <Button variant='outline' onClick={() => router.push('/dashboard/promotions/connections')}>Back to Connections</Button>
        </>
      )}
    </div>
  )
}

export default function OAuthCallbackPage() {
  return (
    <RequirePagePermission permission='social.accounts.manage'>
      <OAuthCallbackPageContent />
    </RequirePagePermission>
  )
}

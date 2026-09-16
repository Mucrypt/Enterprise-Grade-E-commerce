import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import type { SupportProfile } from '../../types'

interface DriftChatProps {
  enabled?: boolean
  supportProfile?: SupportProfile | null
}

const TAWK_SCRIPT_ID = 'techtools-tawk-script'
const GREETING_SEEN_KEY = 'techtools_chat_greeting_seen'

const removeTawkArtifacts = () => {
  document.getElementById(TAWK_SCRIPT_ID)?.remove()
  document
    .querySelectorAll('iframe[src*="tawk.to"], iframe[title*="chat" i]')
    .forEach((node) => node.remove())
  document
    .querySelectorAll('div[class*="tawk" i], div[id*="tawk" i]')
    .forEach((node) => {
      if (node.childElementCount > 0 || node.textContent?.includes('tawk')) {
        node.remove()
      }
    })
  delete window.Tawk_API
  delete window.Tawk_LoadStart
}

/**
 * Live chat -- Tawk.to as the backend, a fully custom launcher as the UI.
 *
 * Tawk's own default widget (oversized launcher, an auto-popping greeting
 * bubble, quick-reply shortcuts, proactive triggers) is configured on
 * tawk.to's dashboard, not reachable from this codebase, and there's no
 * way to make it merely "smaller" -- so instead the default widget is
 * hidden entirely (Tawk_API.hideWidget(), the moment it's ready) and
 * replaced with a small branded launcher button we fully control: closed
 * by default, opens only on click, shows a real online/away/offline
 * status dot and an unread-message badge (via Tawk's documented
 * onStatusChange/onChatMessageAgent callbacks), and a one-time,
 * dismissible greeting bubble instead of Tawk's own -- matching the
 * modern "branded launcher over a chat backend" pattern used by
 * Intercom/Crisp-style integrations.
 */
export function DriftChat({ enabled = false, supportProfile }: DriftChatProps) {
  const appliedProfileRef = useRef<string | null>(null)
  const isOpenRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<'online' | 'away' | 'offline' | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showGreeting, setShowGreeting] = useState(false)

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (!enabled) {
      if (window.Tawk_API && typeof window.Tawk_API.hideWidget === 'function') {
        window.Tawk_API.hideWidget()
      }
      removeTawkArtifacts()
      appliedProfileRef.current = null
      const resetState = () => {
        setReady(false)
        setIsOpen(false)
        setUnreadCount(0)
      }
      resetState()
      return
    }

    const tawkSiteId = import.meta.env.VITE_TAWK_SITE_ID
    const tawkWidgetId = import.meta.env.VITE_TAWK_WIDGET_ID || '1jm6uk6rp'

    if (!tawkSiteId || tawkSiteId === 'YOUR_TAWK_SITE_ID') {
      console.warn('Tawk.to chat not configured. Set VITE_TAWK_SITE_ID environment variable.')
      return
    }

    if (window.Tawk_API) {
      // Already loaded from a previous mount (e.g. route change) --
      // re-attach our callbacks and sync current state instead of
      // re-injecting the script.
      const markReady = () => setReady(true)
      markReady()
      return
    }

    // Tawk_API must exist BEFORE the embed script loads -- it reads
    // these callbacks once on init, not on every render.
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_API.onLoad = () => {
      window.Tawk_API?.hideWidget?.()
      setReady(true)
      const current = window.Tawk_API?.getStatus?.()
      if (current === 'online' || current === 'away' || current === 'offline') {
        setStatus(current)
      }
    }
    window.Tawk_API.onStatusChange = (nextStatus: string) => {
      if (nextStatus === 'online' || nextStatus === 'away' || nextStatus === 'offline') {
        setStatus(nextStatus)
      }
    }
    window.Tawk_API.onChatMaximized = () => {
      setIsOpen(true)
      setUnreadCount(0)
      setShowGreeting(false)
    }
    window.Tawk_API.onChatMinimized = () => {
      setIsOpen(false)
    }
    window.Tawk_API.onChatMessageAgent = () => {
      if (!isOpenRef.current) {
        setUnreadCount((count) => count + 1)
      }
    }
    window.Tawk_LoadStart = new Date()

    const script = document.createElement('script')
    script.id = TAWK_SCRIPT_ID
    script.async = true
    script.src = `https://embed.tawk.to/${tawkSiteId}/${tawkWidgetId}`
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')

    script.onerror = () => {
      console.warn('Failed to load Tawk.to chat widget')
    }

    document.body.appendChild(script)

    return () => {
      if (!enabled) {
        removeTawkArtifacts()
      }
    }
  }, [enabled])

  // One-time greeting bubble (ours, not Tawk's default) -- once per
  // browser session, matching the existing sound-hint convention used
  // elsewhere in Discover (sessionStorage, shown once, dismissible).
  useEffect(() => {
    if (!ready || isOpen) return
    try {
      if (sessionStorage.getItem(GREETING_SEEN_KEY)) return
    } catch {
      return
    }
    const timer = setTimeout(() => {
      setShowGreeting(true)
      try {
        sessionStorage.setItem(GREETING_SEEN_KEY, '1')
      } catch {
        // sessionStorage unavailable (private mode etc.) -- just skip persisting
      }
    }, 4000)
    return () => clearTimeout(timer)
  }, [ready, isOpen])

  useEffect(() => {
    if (!enabled || !supportProfile || !window.Tawk_API) {
      return
    }

    if (appliedProfileRef.current === supportProfile.customer.id) {
      return
    }

    const tawkApi = window.Tawk_API
    const attributes = {
      name: supportProfile.customer.fullName,
      email: supportProfile.customer.email,
      customerTier: supportProfile.loyalty.tier,
      loyaltyPoints: String(supportProfile.loyalty.points),
      totalOrders: String(supportProfile.orderSummary.totalOrders),
      activeOrders: String(supportProfile.orderSummary.activeOrders),
      recentOrderNumber: supportProfile.recentOrder?.order_number || 'none',
      verifiedReviewCount: String(supportProfile.verifiedReviews.length),
    }

    try {
      if (typeof tawkApi.setAttributes === 'function') {
        tawkApi.setAttributes(attributes)
      }

      if (typeof tawkApi.addTags === 'function') {
        tawkApi.addTags(['techtools-customer', supportProfile.loyalty.tier.toLowerCase()])
      }

      appliedProfileRef.current = supportProfile.customer.id
    } catch (error) {
      console.warn('Failed to apply Tawk customer context', error)
    }
  }, [enabled, supportProfile])

  if (!enabled || !ready) return null

  const handleToggle = () => {
    if (!window.Tawk_API) return
    setShowGreeting(false)
    if (isOpen) {
      window.Tawk_API.minimize?.()
    } else {
      window.Tawk_API.maximize?.()
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {showGreeting && (
        <div className="animate-fade-in flex max-w-60 items-start gap-2 rounded-2xl rounded-br-sm bg-white px-4 py-3 text-sm text-gray-800 shadow-xl ring-1 ring-black/5">
          <span className="flex-1">Need help? We're here to answer any questions.</span>
          <button
            type="button"
            onClick={() => setShowGreeting(false)}
            aria-label="Dismiss"
            className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className="animate-fade-in relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}

        {!isOpen && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {!isOpen && status && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
            {status === 'online' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white ${
                status === 'online' ? 'bg-green-500' : status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
              }`}
            />
          </span>
        )}
      </button>
    </div>
  )
}

// Extend Window type to include Tawk
declare global {
  interface Window {
    Tawk_API?: {
      setAttributes?: (attributes: Record<string, string>) => void
      addTags?: (tags: string[]) => void
      maximize?: () => void
      minimize?: () => void
      toggle?: () => void
      hideWidget?: () => void
      showWidget?: () => void
      getStatus?: () => string
      isChatMaximized?: () => boolean
      isChatMinimized?: () => boolean
      isChatHidden?: () => boolean
      onLoad?: () => void
      onStatusChange?: (status: string) => void
      onChatMaximized?: () => void
      onChatMinimized?: () => void
      onChatMessageVisitor?: (message: unknown) => void
      onChatMessageAgent?: (message: unknown) => void
      [key: string]: any
    }
    Tawk_LoadStart?: Date
  }
}

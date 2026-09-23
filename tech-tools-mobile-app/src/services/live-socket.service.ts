// ============================================
// Live shopping -- real-time room connection
// ============================================
// Thin wrapper around socket.io-client for the live:<sessionId> room
// (see tech-tools-api's websocket.service.ts -- the same production
// Socket.io + Redis-adapter server every other real-time feature in
// this app already runs on, not a new server). Chat itself is NOT here
// -- that's IVS Chat's own connection, entirely separate by design (see
// live-session.service.ts's comment on why).
//
// One shared socket for the whole live-viewing session, connected only
// while a LiveViewerScreen is mounted -- never held open in the
// background, unlike auth/notifications which need a longer-lived
// connection.

import { io, Socket } from 'socket.io-client'
import { IMAGE_BASE_URL } from '../config/env'

export interface LiveProductPinnedEvent {
  sessionId: string
  product: { id: string; name?: string; base_price?: string | number; sale_price?: string | number | null }
}

export interface LiveProductUnpinnedEvent {
  sessionId: string
  productId: string
}

export interface LiveSessionEndedEvent {
  sessionId: string
  endedBy: 'seller' | 'admin' | 'webhook'
}

let socket: Socket | null = null

function getSocket(): Socket {
  if (!socket) {
    socket = io(IMAGE_BASE_URL, {
      transports: ['websocket'],
      autoConnect: true,
    })
  }
  return socket
}

export function joinLiveSession(
  sessionId: string,
  handlers: {
    onProductPinned?: (event: LiveProductPinnedEvent) => void
    onProductUnpinned?: (event: LiveProductUnpinnedEvent) => void
    onSessionEnded?: (event: LiveSessionEndedEvent) => void
  },
): () => void {
  const s = getSocket()

  const onPinned = (event: LiveProductPinnedEvent) => {
    if (event.sessionId === sessionId) handlers.onProductPinned?.(event)
  }
  const onUnpinned = (event: LiveProductUnpinnedEvent) => {
    if (event.sessionId === sessionId) handlers.onProductUnpinned?.(event)
  }
  const onEnded = (event: LiveSessionEndedEvent) => {
    if (event.sessionId === sessionId) handlers.onSessionEnded?.(event)
  }

  s.emit('join-live', sessionId)
  s.on('live-product-pinned', onPinned)
  s.on('live-product-unpinned', onUnpinned)
  s.on('live-session-ended', onEnded)

  // Returned cleanup -- call from the screen's useEffect teardown.
  return () => {
    s.emit('leave-live', sessionId)
    s.off('live-product-pinned', onPinned)
    s.off('live-product-unpinned', onUnpinned)
    s.off('live-session-ended', onEnded)
  }
}

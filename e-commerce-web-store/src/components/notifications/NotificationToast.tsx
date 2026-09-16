'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  actionUrl?: string
}

export function NotificationToast() {
  const [toast, setToast] = useState<Notification | null>(null)
  const [recentNotifications, setRecentNotifications] = useState<string[]>([])
  const authToken = localStorage.getItem('auth_token')

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['user-notifications', authToken],
    queryFn: async () => {
      if (!authToken) {
        return { data: { notifications: [] } }
      }

      const response = await fetch('/api/v1/notifications?limit=5', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      // Quietly degrade for auth-expired or disabled notification APIs.
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return { data: { notifications: [] } }
      }

      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
    enabled: Boolean(authToken),
    refetchInterval: 15000,
  })

  // Show toast for new notifications
  useEffect(() => {
    if (!notificationsData?.data?.notifications) return

    const notifications = notificationsData.data.notifications
    if (notifications.length > 0) {
      const newest = notifications[0]
      if (!recentNotifications.includes(newest.id)) {
        setToast(newest)
        setRecentNotifications((prev) => [newest.id, ...prev].slice(0, 10))

        // Auto-hide after 5 seconds
        const timer = setTimeout(() => setToast(null), 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [notificationsData, recentNotifications])

  if (!toast) return null

  return (
    // bottom-24 (not bottom-6) so this doesn't stack under/collide with
    // the persistent chat launcher, which lives at bottom-5 right-5.
    // animate-in/fade-in/slide-in-from-bottom are tailwindcss-animate
    // plugin classes that aren't installed in this project -- they
    // silently generated no CSS at all, so this never actually animated.
    // animate-fade-in is this project's own real, working entrance
    // animation (defined via @theme in src/index.css, the v4-native way).
    <div className='fixed bottom-24 right-6 max-w-sm z-50 animate-fade-in'>
      <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 flex gap-3'>
        <div className='shrink-0'>
          <Bell className='h-5 w-5 text-blue-500' />
        </div>
        <div className='flex-1 min-w-0'>
          <h3 className='font-semibold text-sm text-slate-900 dark:text-white'>{toast.title}</h3>
          {/* text-muted-foreground isn't a real class in this app's Tailwind
              setup (no shadcn theme tokens wired up) -- it resolved to no
              color at all, which read fine by inheritance in light mode but
              made every message illegible against dark:bg-slate-900. */}
          <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>{toast.message}</p>
          {toast.actionUrl && (
            <a
              href={toast.actionUrl}
              className='text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block'
            >
              View Details →
            </a>
          )}
        </div>
        <button
          onClick={() => setToast(null)}
          className='shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
        >
          <X className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}

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
    <div className='fixed bottom-6 right-6 max-w-sm z-50 animate-in fade-in slide-in-from-bottom'>
      <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 flex gap-3'>
        <div className='shrink-0'>
          <Bell className='h-5 w-5 text-blue-500' />
        </div>
        <div className='flex-1 min-w-0'>
          <h3 className='font-semibold text-sm'>{toast.title}</h3>
          <p className='text-xs text-muted-foreground mt-1'>{toast.message}</p>
          {toast.actionUrl && (
            <a
              href={toast.actionUrl}
              className='text-xs text-blue-600 hover:underline mt-2 inline-block'
            >
              View Details →
            </a>
          )}
        </div>
        <button
          onClick={() => setToast(null)}
          className='shrink-0 text-muted-foreground hover:text-foreground'
        >
          <X className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}

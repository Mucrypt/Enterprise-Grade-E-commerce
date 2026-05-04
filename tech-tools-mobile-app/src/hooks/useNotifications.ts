import { useCallback, useState } from 'react'

export interface Notification {
  id: string
  title: string
  message: string
  description?: string
  icon?: string
  actionUrl?: string
  actionLabel?: string
  is_read: boolean
  created_at: string
  data?: Record<string, any>
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const unreadCount = notifications.filter((item) => !item.is_read).length

  const refresh = useCallback(async () => {
    // Hook is intentionally lightweight until API notifications UI is added.
    setIsLoading(true)
    setIsLoading(false)
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, is_read: true } : item,
      ),
    )
  }, [])

  const deleteNotification = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.filter((item) => item.id !== notificationId),
    )
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markAsRead,
    deleteNotification,
  }
}

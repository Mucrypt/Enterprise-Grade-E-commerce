import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken')
      if (!token) return { data: { notifications: [], unreadCount: 0 } }

      const response = await fetch('/api/v1/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return { data: { notifications: [], unreadCount: 0 } }
      return response.json()
    },
    refetchInterval: 30000,
  })

  const notifications = data?.data?.notifications || []
  const unreadCount = data?.data?.unreadCount || 0

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    deleteNotification,
  }
}

export function NotificationBell() {
  const { notifications, unreadCount } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className='relative'>
      <button onPress={() => setIsOpen(!isOpen)} className='relative p-2'>
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className='absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center'>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className='absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto'>
          <div className='sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center'>
            <h3 className='font-semibold'>Notifications</h3>
            <button onPress={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className='divide-y'>
            {notifications.map((notification: Notification) => (
              <div
                key={notification.id}
                className={`p-3 ${!notification.is_read ? 'bg-blue-50' : ''}`}
              >
                <p className='font-semibold text-sm'>{notification.title}</p>
                <p className='text-xs text-gray-600 mt-0.5'>
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                  })}
                </p>
                <p className='text-xs text-gray-700 mt-1'>
                  {notification.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell

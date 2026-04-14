'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, X, AlertCircle, ShoppingCart, Mail } from 'lucide-react'
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

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', localStorage.getItem('auth_token')],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) return { data: { notifications: [], unreadCount: 0 } }

      const response = await fetch('/api/v1/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return { data: { notifications: [], unreadCount: 0 } }
      return response.json()
    },
    refetchInterval: 30000,
  })

  const notifications = notificationsData?.data?.notifications || []
  const unreadCount = notificationsData?.data?.unreadCount || 0

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (error) {
      console.error('Failed to mark as read')
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (error) {
      console.error('Failed to delete notification')
    }
  }

  const getNotificationIcon = (notification: Notification) => {
    switch (true) {
      case notification.data?.type?.includes('order'):
        return <ShoppingCart className='h-4 w-4 text-blue-500' />
      case notification.data?.type?.includes('contact'):
        return <Mail className='h-4 w-4 text-green-500' />
      default:
        return <AlertCircle className='h-4 w-4 text-yellow-500' />
    }
  }

  return (
    <div className='relative'>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
      >
        <Bell className='h-5 w-5' />
        {unreadCount > 0 && (
          <span className='absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className='absolute right-0 mt-2 w-96 bg-white dark:bg-slate-900 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto'>
          {/* Header */}
          <div className='sticky top-0 bg-white dark:bg-slate-900 border-b px-4 py-3 flex justify-between items-center'>
            <h3 className='font-semibold'>Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className='text-gray-500 hover:text-gray-700'
            >
              <X className='h-4 w-4' />
            </button>
          </div>

          {/* Notification List */}
          {isLoading ? (
            <div className='p-4 text-center text-gray-500'>Loading...</div>
          ) : notifications.length === 0 ? (
            <div className='p-4 text-center text-gray-500'>
              No notifications
            </div>
          ) : (
            <div className='divide-y'>
              {notifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${
                    !notification.is_read
                      ? 'bg-blue-50 dark:bg-blue-950/20'
                      : ''
                  }`}
                >
                  <div className='flex gap-3'>
                    <div className='shrink-0'>
                      {getNotificationIcon(notification)}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='font-semibold text-sm'>
                        {notification.title}
                      </p>
                      <p className='text-xs text-gray-600 dark:text-gray-400 mt-0.5'>
                        {formatDistanceToNow(
                          new Date(notification.created_at),
                          { addSuffix: true },
                        )}
                      </p>
                      <p className='text-xs text-gray-700 dark:text-gray-300 mt-1'>
                        {notification.message}
                      </p>
                      <div className='flex gap-2 mt-2'>
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className='text-xs text-blue-600 hover:underline'
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className='text-xs text-red-600 hover:underline'
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell

'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  X,
  Check,
  Archive,
  AlertCircle,
  ShoppingCart,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import apiClient from '@/lib/api-client'

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
  notification_type?: string
  data?: Record<string, any>
}

interface NotificationBellProps {
  onNotificationReceived?: (notification: Notification) => void
}

export function NotificationBell({
  onNotificationReceived,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  const invalidateNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
  }, [queryClient])

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      return apiClient.get<{
        success: boolean
        data: {
          notifications: Notification[]
          unreadCount: number
          limit: number
          offset: number
        }
      }>('/notifications/admin/list?limit=10')
    },
    retry: 1,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const notifications = notificationsData?.data?.notifications || []
  const unreadCount = notificationsData?.data?.unreadCount || 0

  // Mark as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await apiClient.put(`/notifications/admin/${notificationId}/read`)
        invalidateNotifications()
      } catch (error) {
        toast.error('Failed to mark as read')
      }
    },
    [invalidateNotifications],
  )

  // Archive notification
  const archiveNotification = useCallback(
    async (notificationId: string) => {
      try {
        await apiClient.delete(`/notifications/admin/${notificationId}`)
        invalidateNotifications()
        toast.success('Notification dismissed')
      } catch (error) {
        toast.error('Failed to dismiss notification')
      }
    },
    [invalidateNotifications],
  )

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await apiClient.delete(`/notifications/admin/${notificationId}`)
        invalidateNotifications()
        toast.success('Notification deleted')
      } catch (error) {
        toast.error('Failed to delete notification')
      }
    },
    [invalidateNotifications],
  )

  const getNotificationIcon = (notification: Notification) => {
    const notificationType =
      notification.notification_type || notification.data?.type || ''

    if (notificationType.includes('order')) {
      return <ShoppingCart className='h-4 w-4 text-blue-500' />
    }
    if (notificationType.includes('contact')) {
      return <Mail className='h-4 w-4 text-green-500' />
    }
    return <AlertCircle className='h-4 w-4 text-yellow-500' />
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative'
          title='Notifications'
        >
          <Bell className='h-5 w-5' />
          {unreadCount > 0 && (
            <Badge
              variant='destructive'
              className='absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs'
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align='end'
        className='w-96 max-h-96 overflow-y-auto'
      >
        {/* Header */}
        <div className='sticky top-0 bg-white dark:bg-slate-950 border-b px-4 py-3'>
          <h2 className='font-semibold flex items-center justify-between'>
            Notifications
            {unreadCount > 0 && (
              <Badge variant='secondary'>{unreadCount} new</Badge>
            )}
          </h2>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className='p-4 text-center text-muted-foreground'>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className='p-4 text-center text-muted-foreground'>
            No notifications yet
          </div>
        ) : (
          <div className='divide-y'>
            {notifications.map((notification: Notification) => (
              <div
                key={notification.id}
                className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${
                  !notification.is_read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                }`}
              >
                <div className='flex gap-3'>
                  {/* Icon */}
                  <div className='shrink-0 pt-1'>
                    {getNotificationIcon(notification)}
                  </div>

                  {/* Content */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <p className='font-semibold text-sm line-clamp-1'>
                          {notification.title}
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {formatDistanceToNow(
                            new Date(notification.created_at),
                            { addSuffix: true },
                          )}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.is_read && (
                        <div className='w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1' />
                      )}
                    </div>

                    <p className='text-xs text-muted-foreground mt-1 line-clamp-2'>
                      {notification.message}
                    </p>

                    {/* Action buttons */}
                    <div className='flex gap-1 mt-2'>
                      {!notification.is_read && (
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 px-2 text-xs'
                          onClick={() => markAsRead(notification.id)}
                          title='Mark as read'
                        >
                          <Check className='h-3 w-3' />
                        </Button>
                      )}
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-6 px-2 text-xs'
                        onClick={() => archiveNotification(notification.id)}
                        title='Archive'
                      >
                        <Archive className='h-3 w-3' />
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-6 px-2 text-xs text-destructive'
                        onClick={() => deleteNotification(notification.id)}
                        title='Delete'
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    </div>

                    {/* Action link */}
                    {notification.actionUrl && (
                      <a
                        href={notification.actionUrl}
                        className='text-xs text-blue-600 hover:underline mt-2 inline-block'
                      >
                        {notification.actionLabel || 'View Details'} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className='sticky bottom-0 bg-white dark:bg-slate-950 border-t p-2'>
            <Button
              variant='ghost'
              size='sm'
              className='w-full text-xs'
              onClick={() =>
                (window.location.href = '/dashboard/notifications')
              }
            >
              View All Notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell

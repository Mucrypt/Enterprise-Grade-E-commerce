import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'

import {
  getApiErrorContext,
  getApiErrorMessage,
  notificationsApi,
  securityApi,
  type AppNotification,
} from '@/api'
import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { formatRelativeTime } from '@/utils'
import { useAuthStore } from '@/stores'

const iconByType: Record<string, keyof typeof Ionicons.glyphMap> = {
  order_created: 'receipt-outline',
  order_updated: 'car-outline',
  order_delivered: 'checkmark-done-circle-outline',
  payment_failed: 'card-outline',
  promotion: 'pricetag-outline',
}

export default function NotificationsScreen() {
  const router = useRouter()
  const {
    isAuthenticated,
    isLoading: authLoading,
    hasHydrated,
  } = useAuthStore()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
      return
    }

    if (!hasHydrated || !isAuthenticated) {
      return
    }

    loadNotifications()
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  )

  const loadNotifications = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const data = await notificationsApi.getAll({ limit: 60, offset: 0 })
      setNotifications(data.notifications)
    } catch (error: unknown) {
      const err = getApiErrorContext(error, 'Please try again in a moment.')

      if (err.isAuthError) {
        router.replace('/(auth)/login')
        return
      }

      Alert.alert('Unable to load notifications', err.message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      try {
        await notificationsApi.markAsRead(notification.id)
        void securityApi.logSensitiveAction({
          action: 'profile.notification.mark-read',
          status: 'success',
          metadata: { notificationId: notification.id },
        })
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        )
      } catch {
        void securityApi.logSensitiveAction({
          action: 'profile.notification.mark-read',
          status: 'failed',
          metadata: { notificationId: notification.id },
        })
        // Keep UX responsive even if mark read fails
      }
    }

    const actionUrl = notification.data?.actionUrl
    if (typeof actionUrl === 'string' && actionUrl.length > 0) {
      if (actionUrl.startsWith('/')) {
        router.push(actionUrl as never)
        return
      }

      try {
        await Linking.openURL(actionUrl)
      } catch {
        Alert.alert(
          'Action unavailable',
          'Could not open this notification link.',
        )
      }
    }
  }

  const markAllAsRead = async () => {
    try {
      setIsBulkActionLoading(true)
      await notificationsApi.markAllAsRead()
      void securityApi.logSensitiveAction({
        action: 'profile.notification.mark-all-read',
        status: 'success',
      })
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true })),
      )
    } catch (error: unknown) {
      void securityApi.logSensitiveAction({
        action: 'profile.notification.mark-all-read',
        status: 'failed',
      })

      Alert.alert(
        'Action failed',
        getApiErrorMessage(error, 'Could not mark all notifications as read.'),
      )
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const deleteNotification = (id: string) => {
    Alert.alert('Delete notification', 'This notification will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await notificationsApi.delete(id)
            void securityApi.logSensitiveAction({
              action: 'profile.notification.delete',
              status: 'success',
              metadata: { notificationId: id },
            })
            setNotifications((prev) => prev.filter((item) => item.id !== id))
          } catch (error: unknown) {
            void securityApi.logSensitiveAction({
              action: 'profile.notification.delete',
              status: 'failed',
              metadata: { notificationId: id },
            })

            Alert.alert(
              'Delete failed',
              getApiErrorMessage(error, 'Could not delete this notification.'),
            )
          }
        },
      },
    ])
  }

  if (!hasHydrated || authLoading || isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={() => loadNotifications(true)}
          style={styles.iconButton}
        >
          <Ionicons name='refresh' size={18} color={AppColors.gray700} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {unreadCount} unread notification(s)
        </Text>
        <TouchableOpacity
          onPress={markAllAsRead}
          disabled={unreadCount === 0 || isBulkActionLoading}
          style={[
            styles.markAllButton,
            (unreadCount === 0 || isBulkActionLoading) && styles.disabled,
          ]}
        >
          {isBulkActionLoading ? (
            <ActivityIndicator size='small' color={AppColors.primary} />
          ) : (
            <Text style={styles.markAllText}>Mark all read</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={AppColors.primary}
          />
        }
        renderItem={({ item }) => {
          const icon =
            iconByType[item.notification_type] || 'notifications-outline'

          return (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.unreadCard]}
              onPress={() => openNotification(item)}
              activeOpacity={0.86}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconWrap}>
                  <Ionicons name={icon} size={18} color={AppColors.primary} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMessage}>{item.message}</Text>
                  <Text style={styles.cardTime}>
                    {formatRelativeTime(item.created_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                {!item.is_read && <View style={styles.unreadDot} />}
                <TouchableOpacity
                  onPress={() => deleteNotification(item.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name='trash-outline'
                    size={16}
                    color={AppColors.error}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name='notifications-off-outline'
              size={42}
              color={AppColors.gray400}
            />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              Order, delivery, and support updates will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  summaryBar: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
    color: AppColors.gray600,
    fontWeight: '600',
  },
  markAllButton: {
    borderRadius: AppBorderRadius.md,
    borderWidth: 1,
    borderColor: '#FFD7C9',
    backgroundColor: '#FFF1EC',
    minHeight: 32,
    paddingHorizontal: AppSpacing.sm,
    justifyContent: 'center',
  },
  markAllText: {
    fontSize: 12,
    color: AppColors.primary,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  listContent: {
    padding: AppSpacing.base,
    gap: AppSpacing.sm,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: AppSpacing.sm,
  },
  unreadCard: {
    borderWidth: 1,
    borderColor: '#FFE3D8',
  },
  cardLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: AppSpacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF1EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  cardMeta: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  cardMessage: {
    marginTop: 2,
    fontSize: 13,
    color: AppColors.gray600,
    lineHeight: 18,
  },
  cardTime: {
    marginTop: AppSpacing.xs,
    fontSize: 11,
    color: AppColors.gray500,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: AppColors.primary,
    marginTop: 4,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: AppSpacing['3xl'],
  },
  emptyTitle: {
    marginTop: AppSpacing.base,
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray700,
  },
  emptySubtitle: {
    marginTop: AppSpacing.xs,
    fontSize: 13,
    color: AppColors.gray500,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
})

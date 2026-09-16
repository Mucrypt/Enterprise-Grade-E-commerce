// Type-only import -- evaluates to nothing at runtime, so this alone
// can never trigger expo-notifications' own module-init crash below.
import type * as ExpoNotifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi, pushNotificationApi } from '@/api'

type NavigateHandler = (path: string) => void

// =====================================================
// PUSH NOTIFICATION SETUP FOR MOBILE APP
// =====================================================
//
// expo-notifications throws DURING ITS OWN MODULE EVALUATION on Android
// under Expo Go on SDK 53+ (Android push was removed from Expo Go, and
// the package's native-event-emitter setup runs at import time, not on
// first use). A plain top-level `import * as Notifications from
// 'expo-notifications'` therefore crashed the instant this file was
// loaded -- and since this file is imported (via authStore ->
// stores/index -> ProductCard -> components/index) by nearly every
// screen in the app, that one throw was cascading through the whole
// module graph and taking down every route, not just push notifications
// (confirmed live: "missing default export" warnings on ~20 unrelated
// routes were a symptom of this crash aborting their module graphs, not
// real export bugs). Loading the module lazily, only inside the async
// methods below and wrapped in try/catch, contains the failure to
// "push notifications don't work in Expo Go" (the real, unavoidable
// limitation) instead of "the app doesn't work".
let notificationsModulePromise: Promise<typeof ExpoNotifications> | null = null
function loadNotifications(): Promise<typeof ExpoNotifications> {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch((error) => {
      notificationsModulePromise = null
      throw error
    })
  }
  return notificationsModulePromise
}

export class MobileNotificationService {
  /**
   * Initialize push notifications
   */
  static async init(onNavigate?: NavigateHandler) {
    try {
      const Notifications = await loadNotifications()

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      })

      // Request permissions
      await this.requestPermissions(Notifications)

      // Get push token
      const token = await this.getPushToken(Notifications)
      if (token) {
        await this.registerPushToken(token)
      }

      // Listen for notifications
      const cleanup = this.setupListeners(Notifications, onNavigate)

      // Handle case where app is opened from a killed/background state by tap.
      const lastResponse =
        await Notifications.getLastNotificationResponseAsync()
      if (lastResponse) {
        this.handleNotificationTap(lastResponse.notification, onNavigate)
      }

      console.log('Push notifications initialized')
      return cleanup
    } catch (error) {
      console.error('Error initializing push notifications:', error)
      return undefined
    }
  }

  /**
   * Request push notification permissions
   */
  static async requestPermissions(Notifications: typeof ExpoNotifications) {
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications')
      return false
    }

    let permissions = await Notifications.getPermissionsAsync()

    if (!this.isPermissionGranted(Notifications, permissions)) {
      permissions = await Notifications.requestPermissionsAsync()
    }

    if (!this.isPermissionGranted(Notifications, permissions)) {
      console.log('Failed to get push notification permission.')
      return false
    }

    return true
  }

  /**
   * Normalize notification permission checks across expo-notifications versions.
   */
  private static isPermissionGranted(
    Notifications: typeof ExpoNotifications,
    permissions: ExpoNotifications.NotificationPermissionsStatus,
  ): boolean {
    const permissionAny = permissions as any

    if (typeof permissionAny.granted === 'boolean') {
      return permissionAny.granted
    }

    if (typeof permissionAny.status === 'string') {
      return permissionAny.status === 'granted'
    }

    const iosStatus = permissions.ios?.status
    if (typeof iosStatus === 'number') {
      return (
        iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
        iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
      )
    }

    return false
  }

  /**
   * Get push token from Expo
   */
  static async getPushToken(Notifications: typeof ExpoNotifications) {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId) {
        console.error('Missing EAS project ID')
        return null
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data

      console.log('Expo push token:', token)
      return token
    } catch (error) {
      console.error('Error getting push token:', error)
      return null
    }
  }

  /**
   * Register push token with backend. Requires a real signed-in session --
   * guests have no account for the backend to attach a device to (the
   * endpoint requires auth). Previously this checked AsyncStorage for
   * 'userId'/'accessToken', keys the real auth flow never wrote (the app's
   * actual session lives in SecureStore via useAuthStore/apiClient), so
   * this always silently no-opped even when the endpoint existed.
   */
  static async registerPushToken(token: string) {
    try {
      const signedIn = await authApi.isAuthenticated()
      if (!signedIn) return

      const deviceId = Device.osName || 'unknown-device'
      await pushNotificationApi.register(token, deviceId)

      // Cache token locally
      await AsyncStorage.setItem('pushToken', token)
      await AsyncStorage.setItem('pushDeviceId', deviceId)

      console.log('Push token registered with backend')
    } catch (error) {
      console.error('Error registering push token:', error)
    }
  }

  /**
   * Unregister this device's push token -- call on sign-out so a
   * logged-out device stops receiving pushes meant for the account that
   * just signed out of it. Best-effort: never blocks or throws into the
   * caller's sign-out flow.
   */
  static async unregisterPushToken() {
    try {
      const deviceId = await AsyncStorage.getItem('pushDeviceId')
      if (!deviceId) return
      await pushNotificationApi.unregister(deviceId)
      await AsyncStorage.removeItem('pushToken')
      await AsyncStorage.removeItem('pushDeviceId')
    } catch (error) {
      console.error('Error unregistering push token:', error)
    }
  }

  /**
   * Setup notification listeners
   */
  static setupListeners(Notifications: typeof ExpoNotifications, onNavigate?: NavigateHandler) {
    // Listen for notifications in foreground
    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification received (foreground):', notification)
        // Handle foreground notification
        this.handleNotification(notification)
      })

    // Listen for notification interactions (user taps)
    const interactionSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Notification tapped:', response.notification)
        // Handle notification tap - navigate to relevant screen
        this.handleNotificationTap(response.notification, onNavigate)
      })

    return () => {
      foregroundSubscription.remove()
      interactionSubscription.remove()
    }
  }

  /**
   * Handle foreground notification
   */
  static handleNotification(notification: ExpoNotifications.Notification) {
    const { title, body, data } = notification.request.content
    console.log(`[${title}] ${body}`, data)
  }

  /**
   * Handle notification tap - navigate to relevant screen
   */
  static handleNotificationTap(
    notification: ExpoNotifications.Notification,
    onNavigate?: NavigateHandler,
  ) {
    const data = notification.request.content.data
    const route = this.resolveRoute(data as Record<string, any> | undefined)

    if (route && onNavigate) {
      onNavigate(route)
    }
  }

  /**
   * Resolve push payload to an in-app route.
   */
  static resolveRoute(data?: Record<string, any>): string {
    const notificationType = data?.type || data?.notification_type

    // Prefer explicit deep link if present.
    const explicitPath = data?.deepLink || data?.path || data?.route
    if (typeof explicitPath === 'string' && explicitPath.startsWith('/')) {
      return explicitPath
    }

    const productSlug = data?.productSlug || data?.slug
    const categorySlug = data?.categorySlug

    switch (notificationType) {
      case 'product_back_in_stock':
      case 'product_price_drop':
      case 'product_featured':
        if (typeof productSlug === 'string' && productSlug.length > 0) {
          return `/product/${productSlug}`
        }
        return '/products/index'

      case 'category_sale':
      case 'category_featured':
        if (typeof categorySlug === 'string' && categorySlug.length > 0) {
          return `/category/${categorySlug}`
        }
        return '/categories'

      case 'collection_trending':
      case 'trending_update':
      case 'campaign_launch':
        // The old Trending tab is gone -- its real content (collections,
        // featured stores) now lives on Home.
        return '/(tabs)'

      case 'order_placed':
      case 'order_confirmed':
      case 'order_shipped':
      case 'order_delivered':
      case 'payment_received':
        if (typeof data?.orderId === 'string' && data.orderId.length > 0) {
          return `/orders/${data.orderId}`
        }
        return '/orders'

      case 'blog_published':
        if (typeof productSlug === 'string' && productSlug.length > 0) {
          return `/blog/${productSlug}`
        }
        return '/blog/index'

      case 'abandoned_checkout':
        return '/(tabs)/cart'

      default:
        return '/(tabs)/index'
    }
  }

  /**
   * Send local notification (for testing)
   */
  static async sendLocalNotification(
    title: string,
    body: string,
    data: Record<string, any> = {},
  ) {
    try {
      const Notifications = await loadNotifications()
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      })
    } catch (error) {
      console.error('Error sending local notification:', error)
    }
  }
}

export default MobileNotificationService

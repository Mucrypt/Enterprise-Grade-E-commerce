import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

type NavigateHandler = (path: string) => void

// =====================================================
// PUSH NOTIFICATION SETUP FOR MOBILE APP
// =====================================================

export class MobileNotificationService {
  /**
   * Initialize push notifications
   */
  static async init(onNavigate?: NavigateHandler) {
    try {
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
      await this.requestPermissions()

      // Get push token
      const token = await this.getPushToken()
      if (token) {
        await this.registerPushToken(token)
      }

      // Listen for notifications
      const cleanup = this.setupListeners(onNavigate)

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
  static async requestPermissions() {
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications')
      return false
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permission.')
      return false
    }

    return true
  }

  /**
   * Get push token from Expo
   */
  static async getPushToken() {
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
   * Register push token with backend
   */
  static async registerPushToken(token: string) {
    try {
      const userId = await AsyncStorage.getItem('userId')
      const accessToken = await AsyncStorage.getItem('accessToken')

      if (!userId || !accessToken) return

      // Save to backend
      await axios.post(
        '/api/v1/users/push-token',
        { pushToken: token, deviceId: Device.osName },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      // Cache token locally
      await AsyncStorage.setItem('pushToken', token)

      console.log('Push token registered with backend')
    } catch (error) {
      console.error('Error registering push token:', error)
    }
  }

  /**
   * Setup notification listeners
   */
  static setupListeners(onNavigate?: NavigateHandler) {
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
  static handleNotification(notification: Notifications.Notification) {
    const { title, body, data } = notification.request.content
    console.log(`[${title}] ${body}`, data)
  }

  /**
   * Handle notification tap - navigate to relevant screen
   */
  static handleNotificationTap(
    notification: Notifications.Notification,
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
        return '/(tabs)/trending'

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

// ============================================
// TechTools Mobile App - Root Layout
// ============================================

import { Ionicons } from '@expo/vector-icons'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect, useState } from 'react'
import { useColorScheme, StatusBar } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AnimatedSplashOverlay } from '@/components/animated-icon'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ScreenViewTracker from '@/components/ScreenViewTracker'
import ReferralCapture from '@/components/ReferralCapture'
import MobileNotificationService from '@/services/notification.service'
import { useAuthStore } from '@/stores'
import { initializeEventTracking } from '@/services/event-tracking'

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const { initialize, isInitialized } = useAuthStore()
  const [appReady, setAppReady] = useState(false)

  // Every <Ionicons> instance across the app (72+ usage sites) otherwise
  // loads this font independently on its own mount -- expo-font's cache
  // only remembers a SUCCESSFUL load, not a failed one, so on a broken
  // dev-server connection every icon that mounts as the user navigates
  // fires its own fresh download and its own logged rejection. Loading
  // it once here, up front, means at most one failure gets logged for
  // the whole session instead of one per icon mount (this only matters
  // in dev -- a standalone/production build has fonts statically bundled
  // and never hits the network for this at all).
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font })

  useEffect(() => {
    let cleanupNotifications: (() => void) | undefined

    const init = async () => {
      // Initialize event tracking on app launch
      initializeEventTracking()

      await initialize()
      cleanupNotifications = await MobileNotificationService.init((path) => {
        router.push(path as never)
      })
      setAppReady(true)
    }

    init()

    return () => {
      if (cleanupNotifications) {
        cleanupNotifications()
      }
    }
  }, [])

  useEffect(() => {
    if (appReady && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync()
    }
  }, [appReady, fontsLoaded, fontError])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <StatusBar
            barStyle='dark-content'
            backgroundColor='transparent'
            translucent
          />
          <AnimatedSplashOverlay />
          <ScreenViewTracker />
          <ReferralCapture />
          <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
              <Stack.Screen name='(auth)' options={{ headerShown: false }} />
              <Stack.Screen
                name='product/[slug]'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='products/index'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='blog/index'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='blog/[slug]'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='book/[id]'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='checkout'
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name='support'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='help-center'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='contact-us'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='rate-app'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='returns'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/edit'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/addresses'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/payment-methods'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/notifications'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/settings'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/seller'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='profile/seller-products'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='seller/[handle]'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='refer-earn'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='orders/index'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='orders/[id]'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name='track-order'
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
            </Stack>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

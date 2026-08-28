// ============================================
// TechTools Mobile App - Error Boundary
// ============================================
//
// Global safety net wrapping the root Stack (see _layout.tsx). Without this,
// any render-time exception anywhere in the tree unmounts the entire app with
// no recovery UI -- React Native's dev red-screen doesn't even show in a
// production build, so a user just sees a blank/frozen screen.

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { securityApi } from '@/api'
import Button from '@/components/Button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { AppColors, AppSpacing } from '@/constants/appTheme'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)

    // Best-effort only -- reuses the existing security/client-events audit
    // endpoint instead of pulling in a dedicated crash reporter for now, so
    // crashes are at least visible somewhere instead of only on-device.
    void securityApi
      .logSensitiveAction({
        action: 'client_render_error',
        status: 'failed',
        metadata: {
          message: error.message,
          stack: error.stack?.slice(0, 2000),
          componentStack: info.componentStack?.slice(0, 2000),
        },
      })
      .catch(() => {})
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  private handleGoHome = () => {
    this.setState({ error: null })
    try {
      router.replace('/(tabs)')
    } catch {
      // Router not ready yet -- Try Again is still available.
    }
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <ThemedView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Ionicons
              name='alert-circle-outline'
              size={64}
              color={AppColors.error}
            />
            <ThemedText type='subtitle' style={styles.title}>
              Something went wrong
            </ThemedText>
            <ThemedText themeColor='textSecondary' style={styles.message}>
              We hit an unexpected error. You can try again or head back to
              the home screen.
            </ThemedText>
            {__DEV__ ? (
              <ThemedText
                type='code'
                themeColor='textSecondary'
                style={styles.devError}
              >
                {error.message}
              </ThemedText>
            ) : null}
            <Button
              title='Try Again'
              onPress={this.handleRetry}
              fullWidth
              style={styles.button}
            />
            <Button
              title='Go to Home'
              onPress={this.handleGoHome}
              variant='outline'
              fullWidth
              style={styles.button}
            />
          </ScrollView>
        </ThemedView>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: AppSpacing['2xl'],
  },
  title: {
    marginTop: AppSpacing.lg,
    textAlign: 'center',
  },
  message: {
    marginTop: AppSpacing.sm,
    textAlign: 'center',
  },
  devError: {
    marginTop: AppSpacing.base,
    textAlign: 'center',
    opacity: 0.7,
  },
  button: {
    marginTop: AppSpacing.base,
  },
})

// ============================================
// TechTools Mobile App - Button Component
// ============================================

import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import {
  AppColors,
  AppBorderRadius,
  AppSpacing,
  AppGradients,
} from '@/constants/appTheme'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode | string
  style?: ViewStyle
  textStyle?: TextStyle
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: AppSpacing.sm,
          paddingHorizontal: AppSpacing.base,
          fontSize: 13,
        }
      case 'large':
        return {
          paddingVertical: AppSpacing.lg,
          paddingHorizontal: AppSpacing['2xl'],
          fontSize: 17,
        }
      default:
        return {
          paddingVertical: AppSpacing.md,
          paddingHorizontal: AppSpacing.xl,
          fontSize: 15,
        }
    }
  }

  const sizeStyles = getSizeStyles()

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: [styles.button, { backgroundColor: AppColors.secondary }],
          text: { color: AppColors.white },
        }
      case 'outline':
        return {
          container: [styles.button, styles.outlineButton],
          text: { color: AppColors.primary },
        }
      case 'ghost':
        return {
          container: [styles.button, { backgroundColor: 'transparent' }],
          text: { color: AppColors.primary },
        }
      default:
        return {
          container: [styles.button],
          text: { color: AppColors.white },
          gradient: true,
        }
    }
  }

  const variantStyles = getVariantStyles()

  // Render icon - supports both string (Ionicons name) and React.ReactNode
  const renderIcon = () => {
    if (!icon) return null
    if (typeof icon === 'string') {
      const iconColor =
        variant === 'outline' || variant === 'ghost'
          ? AppColors.primary
          : AppColors.white
      return (
        <Ionicons
          name={icon as any}
          size={sizeStyles.fontSize + 3}
          color={iconColor}
        />
      )
    }
    return icon
  }

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'outline' || variant === 'ghost'
              ? AppColors.primary
              : AppColors.white
          }
        />
      ) : (
        <>
          {renderIcon()}
          <Text
            style={[
              styles.text,
              { fontSize: sizeStyles.fontSize },
              variantStyles.text,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </>
  )

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={
            isDisabled
              ? [AppColors.gray300, AppColors.gray400]
              : (AppGradients.primary as [string, string])
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.button,
            {
              paddingVertical: sizeStyles.paddingVertical,
              paddingHorizontal: sizeStyles.paddingHorizontal,
            },
          ]}
        >
          {buttonContent}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        ...variantStyles.container,
        {
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {buttonContent}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: AppBorderRadius.lg,
    gap: AppSpacing.sm,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  text: {
    fontWeight: '600',
  },
  fullWidth: {
    width: '100%',
  },
})

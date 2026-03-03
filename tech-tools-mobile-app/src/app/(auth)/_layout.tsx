// ============================================
// TechTools Mobile App - Auth Layout
// ============================================

import React from 'react'
import { Stack } from 'expo-router'
import { AppColors } from '@/constants/appTheme'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppColors.background },
      }}
    >
      <Stack.Screen name='login' />
      <Stack.Screen name='register' />
      <Stack.Screen name='forgot-password' />
    </Stack>
  )
}

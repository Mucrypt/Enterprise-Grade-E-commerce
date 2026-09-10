// ============================================
// TechTools Mobile App - Search Bar Component
// ============================================

import React, { useState } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import {
  AppColors,
  AppBorderRadius,
  AppSpacing,
  AppShadows,
} from '@/constants/appTheme'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  autoFocus?: boolean
  value?: string
  onChangeText?: (text: string) => void
  onSubmit?: () => void
  // Tighter padding + a true full-pill shape (vs. the default's roomier
  // touch target) for placements like the sticky home header, where the
  // bar sits alongside icon buttons and needs to read as one sleek row
  // rather than its own oversized element. Every other usage (the full
  // search screen, product listing) is unaffected -- default is false.
  compact?: boolean
}

export default function SearchBar({
  placeholder = 'Search products...',
  onSearch,
  autoFocus = false,
  value,
  onChangeText,
  onSubmit,
  compact = false,
}: SearchBarProps) {
  const router = useRouter()
  const [internalQuery, setInternalQuery] = useState('')

  // Support both controlled and uncontrolled modes
  const query = value !== undefined ? value : internalQuery
  const setQuery = onChangeText || setInternalQuery

  const handleSubmit = () => {
    if (query.trim()) {
      if (onSubmit) {
        onSubmit()
      } else if (onSearch) {
        onSearch(query.trim())
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}` as any)
      }
    }
  }

  const handleClear = () => {
    setQuery('')
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Ionicons
        name='search-outline'
        size={compact ? 17 : 20}
        color={AppColors.gray400}
      />
      <TextInput
        style={[styles.input, compact && styles.inputCompact]}
        placeholder={placeholder}
        placeholderTextColor={AppColors.gray400}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSubmit}
        returnKeyType='search'
        autoFocus={autoFocus}
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={handleClear}>
          <Ionicons
            name='close-circle'
            size={compact ? 17 : 20}
            color={AppColors.gray400}
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.xl,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    gap: AppSpacing.sm,
    ...AppShadows.sm,
  },
  containerCompact: {
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: 9,
    gap: AppSpacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: AppColors.gray800,
  },
  inputCompact: {
    fontSize: 13,
  },
})

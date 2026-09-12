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
  // Tighter padding + a bordered rectangular field (SHEIN reference, vs.
  // the default's roomier full-pill shape) for placements like the sticky
  // home header, where the bar sits alongside icon buttons and needs to
  // read as one sleek row rather than its own oversized element. Every
  // other usage (the full search screen, product listing) is unaffected
  // -- default is false.
  compact?: boolean
  // A dark search button inset inside the same field (SHEIN reference),
  // not a separate button floating outside it. Fires the exact same real
  // submit action as pressing enter in the field -- not a second,
  // different feature, just a second way to trigger the one real search.
  showSubmitButton?: boolean
}

export default function SearchBar({
  placeholder = 'Search products...',
  onSearch,
  autoFocus = false,
  value,
  onChangeText,
  onSubmit,
  compact = false,
  showSubmitButton = false,
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

      {showSubmitButton && (
        <TouchableOpacity
          style={[styles.submitButton, compact && styles.submitButtonCompact]}
          activeOpacity={0.85}
          onPress={handleSubmit}
        >
          <Ionicons
            name='search'
            size={compact ? 15 : 18}
            color={AppColors.white}
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    // A single, unified field (SHEIN reference) -- the submit button lives
    // INSIDE this same bordered box, inset with a small margin, rather than
    // floating as a separate circle outside it with a gap.
    borderRadius: AppBorderRadius.lg,
    paddingLeft: AppSpacing.md,
    paddingRight: 4,
    paddingVertical: 4,
    gap: AppSpacing.xs,
    // A visible border (not just the shadow) is what makes this read as
    // a crisp, defined field rather than a soft rounded rectangle.
    borderWidth: 1,
    borderColor: AppColors.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: AppColors.gray800,
  },
  inputCompact: {
    fontSize: 13,
  },
  submitButton: {
    width: 40,
    height: 40,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonCompact: {
    width: 30,
    height: 30,
    borderRadius: AppBorderRadius.md,
  },
})

// ============================================
// TechTools Mobile App - Search Bar Component
// ============================================

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppColors, AppBorderRadius, AppSpacing, AppShadows } from '@/constants/appTheme';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
}

export default function SearchBar({ placeholder = 'Search products...', onSearch, autoFocus = false }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    if (query.trim()) {
      if (onSearch) {
        onSearch(query.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={20} color={AppColors.gray400} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={AppColors.gray400}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={handleClear}>
          <Ionicons name="close-circle" size={20} color={AppColors.gray400} />
        </TouchableOpacity>
      )}
    </View>
  );
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
  input: {
    flex: 1,
    fontSize: 15,
    color: AppColors.gray800,
  },
});

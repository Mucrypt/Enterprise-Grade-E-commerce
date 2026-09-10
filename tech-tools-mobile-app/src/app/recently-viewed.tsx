// ============================================
// TechTools Mobile App - Recently Viewed Screen
// ============================================
// Real, on-device browsing history -- every product here was genuinely
// opened by this user (recorded from product/[slug].tsx), most recent
// first. Never a fabricated "you might like" or "popular" substitute --
// an empty history shows an honest empty state, not a fallback list.
// ============================================

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ProductCard } from '@/components'
import { AppColors, AppSpacing } from '@/constants/appTheme'
import { useRecentlyViewedStore } from '@/stores'

const { width } = Dimensions.get('window')
const CARD_WIDTH = (width - AppSpacing.base * 3) / 2

export default function RecentlyViewedScreen() {
  const router = useRouter()
  const { items, clearAll } = useRecentlyViewedStore()

  const handleClearAll = () => {
    Alert.alert(
      'Clear Recently Viewed',
      'Remove all items from your browsing history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearAll },
      ],
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Recently Viewed',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
            </TouchableOpacity>
          ),
          headerRight: () =>
            items.length > 0 ? (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearButton}>Clear All</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name='time-outline' size={64} color={AppColors.gray300} />
            <Text style={styles.emptyTitle}>No browsing history yet</Text>
            <Text style={styles.emptyText}>
              Products you open will show up here so you can find them again
              quickly.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <View style={styles.cardContainer}>
                <ProductCard product={item} />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.error,
  },
  listContent: {
    padding: AppSpacing.base,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: AppSpacing.md,
  },
  cardContainer: {
    width: CARD_WIDTH,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xl,
  },
  emptyTitle: {
    marginTop: AppSpacing.lg,
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray800,
  },
  emptyText: {
    marginTop: AppSpacing.sm,
    fontSize: 14,
    color: AppColors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
})

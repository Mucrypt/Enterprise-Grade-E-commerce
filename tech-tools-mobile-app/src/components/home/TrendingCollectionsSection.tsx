// ============================================
// TechTools Mobile App - Trending Collections Section (Home)
// ============================================
// Folded in from the old standalone Trending tab now that its nav slot
// belongs to the Discover feed -- same real data, same
// TrendingCollectionCard, just living on Home now. Self-contained (own
// data fetch), matching every other Home section's pattern.

import React, { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { collectionsApi } from '@/api'
import { ProductCollection } from '@/types'
import { AppSpacing } from '@/constants/appTheme'
import TrendingCollectionCard from '@/components/trending/TrendingCollectionCard'
import SectionHeader from '@/components/SectionHeader'

export default function TrendingCollectionsSection() {
  const [collections, setCollections] = useState<ProductCollection[]>([])

  useEffect(() => {
    let cancelled = false
    collectionsApi
      .getFeatured(8)
      .then((data) => {
        if (!cancelled) setCollections(data)
      })
      .catch(() => {
        if (!cancelled) setCollections([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (collections.length === 0) return null

  return (
    <View style={styles.section}>
      <SectionHeader title="Trending Collections" subtitle="Curated for you" icon="sparkles" />
      <FlatList
        horizontal
        data={collections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TrendingCollectionCard collection={item} products={item.products || []} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: AppSpacing.lg,
  },
  horizontalList: {
    paddingHorizontal: AppSpacing.base,
  },
})

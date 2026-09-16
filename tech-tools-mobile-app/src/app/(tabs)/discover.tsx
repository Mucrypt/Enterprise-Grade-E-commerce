// ============================================
// TechTools Mobile App - Discover Tab Screen
// ============================================
// Vertical, TikTok-style shoppable feed. Adapted from ToolsHero.tsx's
// horizontal-paging FlatList pattern (swap horizontal->vertical), with
// the two real fixes that pattern needed for a full-screen vertical feed:
// (1) slide height uses useBottomTabBarHeight() for the exact real tab
// bar height, not a guessed constant -- this tab keeps its bottom bar
// visible while scrolling, so each slide must fit the space above it, or
// getItemLayout drifts over many swipes; (2) video play/pause is driven
// by onViewableItemsChanged (viewabilityConfig itemVisiblePercentThreshold:
// 90), not a setInterval timer like the hero carousel's auto-advance.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewToken,
} from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { Audio } from 'expo-av'
import { discoverApi, DiscoverPost } from '@/api'
import DiscoverSlide from '@/components/discover/DiscoverSlide'
import ProductBottomSheet from '@/components/discover/ProductBottomSheet'
import { getEventTracker } from '@/services/event-tracking'
import { Product } from '@/types'
import { AppColors } from '@/constants/appTheme'

const { height: WINDOW_HEIGHT } = Dimensions.get('window')

export default function DiscoverTabScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const slideHeight = WINDOW_HEIGHT - tabBarHeight

  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{
    products: Product[]
    initialProductId?: string
    discoverPostId: string
  } | null>(null)

  const loadingRef = useRef(false)

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (nextPage === 1) setLoading(true)
    try {
      const result = await discoverApi.getFeed(nextPage, 10)
      setPosts((prev) => (nextPage === 1 ? result.posts : [...prev, ...result.posts]))
      setHasMore(result.hasMore)
      setPage(nextPage)
      if (nextPage === 1 && result.posts.length > 0) setActiveId(result.posts[0].id)
    } catch {
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPage(1)
  }, [loadPage])

  // Posts with a background track (see DiscoverSlide's Audio.Sound
  // usage) should play like TikTok/Reels -- audible even when the
  // device's silent switch is on, not swallowed like a system sound.
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false }).catch(() => {})
  }, [])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((v) => v.isViewable)
      if (visible?.item) setActiveId((visible.item as DiscoverPost).id)
    },
  ).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 90 }).current

  const handleEndReached = () => {
    if (!loadingRef.current && hasMore) loadPage(page + 1)
  }

  const handleOpenProduct = (post: DiscoverPost, productId?: string) => {
    setSheet({ products: post.products, initialProductId: productId, discoverPostId: post.id })
    getEventTracker().trackDiscoverEvent('discover_product_card_open', post.id, { productId })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
      </View>
    )
  }

  if (posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Nothing to show yet -- check back soon.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DiscoverSlide
            post={item}
            height={slideHeight}
            isActive={activeId === item.id}
            onOpenProduct={(productId) => handleOpenProduct(item, productId)}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: slideHeight,
          offset: slideHeight * index,
          index,
        })}
        onEndReached={handleEndReached}
        onEndReachedThreshold={1.5}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews
      />

      {sheet && (
        <ProductBottomSheet
          visible={!!sheet}
          products={sheet.products}
          initialProductId={sheet.initialProductId}
          discoverPostId={sheet.discoverPostId}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.black,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: AppColors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
})

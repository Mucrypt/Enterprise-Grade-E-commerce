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
import { setAudioModeAsync } from 'expo-audio'
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
    const init = () => {
      loadPage(1)
    }
    init()
  }, [loadPage])

  // Posts with a background track (see DiscoverSlide's expo-audio
  // usage) should play like TikTok/Reels -- audible even when the
  // device's silent switch is on, not swallowed like a system sound.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {})
  }, [])

  // FlatList's own docs require viewabilityConfig/onViewableItemsChanged
  // to keep the same reference across renders (it warns/throws if they
  // change) -- useRef(...).current is the standard, correct RN idiom for
  // that, not a real "ref read during render" bug the newer
  // react-hooks/refs check is meant to catch.
  // eslint-disable-next-line react-hooks/refs
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((v) => v.isViewable)
      if (visible?.item) setActiveId((visible.item as DiscoverPost).id)
    },
  ).current

  // eslint-disable-next-line react-hooks/refs
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
        // pagingEnabled snaps to the FlatList's own measured frame height,
        // NOT the slideHeight used below in getItemLayout -- any tiny
        // mismatch between the two (safe-area insets, notch, a status bar
        // height that Dimensions.get('window') doesn't perfectly account
        // for) compounds with every swipe, which is exactly what showed
        // up live: the first slide centered fine, then each subsequent
        // one drifted further off until slides were showing half-and-half.
        // snapToInterval driven by the SAME slideHeight value as
        // getItemLayout guarantees both agree on exactly where each slide
        // starts, so there's nothing left to drift.
        snapToInterval={slideHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        // With nothing below the last slide (or above the first) to snap
        // against, elastic overscroll can carry a fling slightly past its
        // true position and rest there instead of snapping back --
        // confirmed live: only the last slide's product card (anchored to
        // the bottom of its own slide) visibly shifted, since the whole
        // slide was resting a bit higher than its real snap point.
        // Disabling bounce/overscroll means every slide, first and last
        // included, can only ever rest exactly on a snapToInterval
        // boundary.
        bounces={false}
        overScrollMode="never"
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
        // removeClippedSubviews has long-documented Android rendering bugs
        // when list items contain complex native views (video players,
        // BlurView, absolutely-positioned overlays) -- exactly what each
        // Discover slide is. Confirmed live: reached only when scrolling
        // into a slide, at rest, after a full reload (so not a stale-code
        // or mid-gesture issue) -- a clipped-then-reattached slide can
        // render with the wrong/stale content instead of a real scroll
        // misalignment. With only a handful of posts in this feed, the
        // memory/perf win this prop exists for is negligible anyway.
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

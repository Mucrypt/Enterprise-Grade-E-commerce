// ============================================
// TechTools Mobile App - Trending Stores Section (Home)
// ============================================
// Folded in from the old standalone Trending tab now that its nav slot
// belongs to the Discover feed -- same real per-brand stats, same real
// follow/unfollow, same real testimonial, just living on Home now.
// Self-contained (own data fetch), matching every other Home section.

import React, { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { trendingApi, brandsApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { Brand, Product } from '@/types'
import { AppSpacing } from '@/constants/appTheme'
import TrendingBrandSection from '@/components/trending/TrendingBrandSection'
import SectionHeader from '@/components/SectionHeader'

type BrandStatsMap = Record<
  string,
  { productCount: number; unitsSold: number; revenueTotal: number; newProductsCount: number; followerCount: number }
>
type TopReviewsMap = Record<string, { rating: number; comment: string; authorName: string }>

export default function TrendingStoresSection() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [brandsWithProducts, setBrandsWithProducts] = useState<{ brand: Brand; products: Product[] }[]>([])
  const [brandStats, setBrandStats] = useState<BrandStatsMap>({})
  const [topReviews, setTopReviews] = useState<TopReviewsMap>({})
  const [followedBrandIds, setFollowedBrandIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    try {
      const brandsRes = await trendingApi.getBrandsWithProducts(6, 4)
      setBrandsWithProducts(brandsRes)

      const brandIds = brandsRes.map((b) => b.brand.id)
      if (brandIds.length > 0) {
        const { stats, topReviews: reviews } = await brandsApi.getStats(brandIds)
        setBrandStats(stats)
        setTopReviews(reviews)
      }

      if (isAuthenticated) {
        try {
          const followed = await brandsApi.getFollowed()
          setFollowedBrandIds(new Set(followed))
        } catch {
          // Best-effort -- an empty set just means every card shows "Follow".
        }
      }
    } catch (error) {
      console.error('Error fetching trending stores:', error)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const init = () => {
      fetchData()
    }
    init()
  }, [fetchData])

  const handleToggleFollow = useCallback(
    async (brandId: string) => {
      if (!isAuthenticated) {
        router.push('/(auth)/login')
        return
      }

      const isFollowing = followedBrandIds.has(brandId)
      setFollowedBrandIds((prev) => {
        const next = new Set(prev)
        if (isFollowing) next.delete(brandId)
        else next.add(brandId)
        return next
      })
      setBrandStats((prev) => {
        if (!prev[brandId]) return prev
        const delta = isFollowing ? -1 : 1
        return {
          ...prev,
          [brandId]: { ...prev[brandId], followerCount: Math.max(0, prev[brandId].followerCount + delta) },
        }
      })

      try {
        if (isFollowing) await brandsApi.unfollow(brandId)
        else await brandsApi.follow(brandId)
      } catch {
        setFollowedBrandIds((prev) => {
          const next = new Set(prev)
          if (isFollowing) next.add(brandId)
          else next.delete(brandId)
          return next
        })
      }
    },
    [followedBrandIds, isAuthenticated, router],
  )

  if (brandsWithProducts.length === 0) return null

  return (
    <View style={styles.section}>
      <SectionHeader title="Featured Stores" subtitle="Top brands & sellers" icon="storefront-outline" />
      {brandsWithProducts.map((item) => (
        <TrendingBrandSection
          key={item.brand.id}
          brand={item.brand}
          products={item.products}
          stats={
            brandStats[item.brand.id]
              ? {
                  soldCount: brandStats[item.brand.id].unitsSold,
                  newProductsCount: brandStats[item.brand.id].newProductsCount,
                  followerCount: brandStats[item.brand.id].followerCount,
                }
              : undefined
          }
          review={topReviews[item.brand.id]}
          isFollowing={followedBrandIds.has(item.brand.id)}
          onToggleFollow={() => handleToggleFollow(item.brand.id)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: AppSpacing.lg,
  },
})

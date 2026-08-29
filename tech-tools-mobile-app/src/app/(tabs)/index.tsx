// ============================================
// TechTools Mobile App - Home Tab Screen
//
// Rebuilt for full content/tone parity with the web storefront's
// professional-tools/B2B homepage (e-commerce-web-store's
// HomePage.tsx + src/components/home/*). Same section order, same
// real data sources, same honesty principle: nothing here renders
// a hardcoded number, rating or count -- every section either
// shows real API data or (Featured Brands / Tool Knowledge) renders
// nothing at all when there's no real content.
//
// Flash Deals and the mobile-only Promo Banners grid have been
// removed per the founder's decision -- neither has a web
// equivalent. The fake Featured/Best Sellers/New tab switcher is
// gone too: there's no real ranking data behind "Best Sellers" or
// "New", so only a single, honest "Featured" section remains.
// ============================================

import React, { useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppColors } from '@/constants/appTheme'
import {
  ToolsHero,
  TrustStrip,
  ShopByTrade,
  FeaturedProfessionalTools,
  WorkshopMachinerySection,
  BusinessBuyerSection,
  ProfessionalBrands,
  ToolKnowledgeSection,
  HomepageNewsletter,
} from '@/components/home'

export default function HomeTabScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const onRefresh = async () => {
    setRefreshing(true)
    // Each section owns its own data fetching (mirrors the web
    // homepage's per-section components); remounting them via a key
    // change re-triggers those fetches on pull-to-refresh.
    setRefreshKey((key) => key + 1)
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[AppColors.primary]}
          />
        }
      >
        <View key={refreshKey}>
          {/* Professional Hero */}
          <ToolsHero />

          {/* Trust / service strip */}
          <TrustStrip />

          {/* Shop by Trade */}
          <ShopByTrade />

          {/* Featured Professional Tools */}
          <FeaturedProfessionalTools />

          {/* Workshop Machinery feature */}
          <WorkshopMachinerySection />

          {/* Business & Bulk Orders (B2B) */}
          <BusinessBuyerSection />

          {/* Professional Brands */}
          <ProfessionalBrands />

          {/* Tool Guides & Workshop Knowledge */}
          <ToolKnowledgeSection />

          {/* Newsletter Signup */}
          <HomepageNewsletter />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
})

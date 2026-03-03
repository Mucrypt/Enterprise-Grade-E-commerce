// ============================================
// TechTools Mobile App - Home Tab Screen
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  HeroSection,
  SectionHeader,
  FlashDealCard,
  CategoryCard,
  ProductCard,
  PromoBanner,
} from '@/components'
import { AppColors, AppSpacing, PromoBanners } from '@/constants/appTheme'
import { productsApi, categoriesApi, brandsApi } from '@/api'
import { Product, Category, Brand } from '@/types'

const { width } = Dimensions.get('window')

export default function HomeTabScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data states
  const [flashDeals, setFlashDeals] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [activeTab, setActiveTab] = useState<
    'featured' | 'bestsellers' | 'new'
  >('featured')

  const fetchData = async () => {
    try {
      const [categoriesRes, featuredRes, newRes, brandsRes] = await Promise.all(
        [
          categoriesApi.getAll(),
          productsApi.getFeatured(8),
          productsApi.getNewArrivals(8),
          brandsApi.getAll(),
        ],
      )

      setCategories(categoriesRes.slice(0, 10))
      setFeaturedProducts(featuredRes)
      setFlashDeals(featuredRes.slice(0, 8))
      setNewArrivals(newRes)
      setBrands(brandsRes.slice(0, 8))
    } catch (error) {
      console.error('Error fetching home data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const dealEndTime = new Date(Date.now() + 6 * 60 * 60 * 1000)
  const badges: ('HOT' | 'FLASH' | 'DEAL')[] = [
    'HOT',
    'FLASH',
    'DEAL',
    'HOT',
    'FLASH',
    'DEAL',
    'HOT',
    'FLASH',
  ]

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[AppColors.primary]}
          />
        }
      >
        {/* Hero Section */}
        <HeroSection />

        {/* Flash Deals Section */}
        <View style={styles.section}>
          <SectionHeader
            title='Flash Deals'
            subtitle='Ends in 6 hours'
            icon='flash'
            onAction={() => router.push('/products?deals=true')}
          />
          <FlatList
            horizontal
            data={flashDeals}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <FlashDealCard
                product={item}
                badge={badges[index % badges.length]}
                endTime={dealEndTime}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <SectionHeader
            title='Shop by Category'
            icon='grid-outline'
            onAction={() => router.push('/categories')}
          />
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CategoryCard category={item} size='medium' />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => (
              <View style={{ width: AppSpacing.md }} />
            )}
          />
        </View>

        {/* Promo Banners */}
        <View style={styles.section}>
          <View style={styles.promoBannersGrid}>
            {PromoBanners.map((banner) => (
              <PromoBanner
                key={banner.id}
                title={banner.title}
                subtitle={banner.subtitle}
                icon={banner.icon}
                gradient={banner.gradient}
              />
            ))}
          </View>
        </View>

        {/* Featured Products Section */}
        <View style={styles.section}>
          <SectionHeader
            title='Featured Products'
            icon='star-outline'
            onAction={() => router.push('/products?featured=true')}
          />

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['featured', 'bestsellers', 'new'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.activeTabText,
                  ]}
                >
                  {tab === 'featured'
                    ? 'Featured'
                    : tab === 'bestsellers'
                    ? 'Best Sellers'
                    : 'New'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Products Grid */}
          <View style={styles.productsGrid}>
            {(activeTab === 'new' ? newArrivals : featuredProducts)
              .slice(0, 6)
              .map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
          </View>
        </View>

        {/* Brand Showcase */}
        <View style={[styles.section, styles.lastSection]}>
          <SectionHeader
            title='Top Brands'
            icon='ribbon-outline'
            onAction={() => router.push('/brands')}
          />
          <FlatList
            horizontal
            data={brands}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.brandCard}
                onPress={() => router.push(`/products?brand=${item.slug}`)}
              >
                <View style={styles.brandLogo}>
                  <Text style={styles.brandInitial}>{item.name.charAt(0)}</Text>
                </View>
                <Text style={styles.brandName} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => (
              <View style={{ width: AppSpacing.md }} />
            )}
          />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  section: {
    marginTop: AppSpacing.lg,
  },
  lastSection: {
    marginBottom: AppSpacing['3xl'],
  },
  horizontalList: {
    paddingHorizontal: AppSpacing.base,
  },
  promoBannersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.md,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  tab: {
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.base,
    borderRadius: 20,
    backgroundColor: AppColors.gray100,
  },
  activeTab: {
    backgroundColor: AppColors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: AppColors.gray600,
  },
  activeTabText: {
    color: AppColors.white,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
  },
  brandCard: {
    alignItems: 'center',
    width: 80,
  },
  brandLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  brandInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.primary,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '500',
    color: AppColors.gray700,
    textAlign: 'center',
  },
})

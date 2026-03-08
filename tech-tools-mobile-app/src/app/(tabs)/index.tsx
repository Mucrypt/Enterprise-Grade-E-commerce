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
  Image,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
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
import { productsApi, categoriesApi, brandsApi, blogApi } from '@/api'
import { Product, Category, Brand, BlogPost } from '@/types'

// Premium brand gradients
const BRAND_GRADIENTS: [string, string][] = [
  ['#FF6B35', '#FF8F6B'],
  ['#6366F1', '#8B5CF6'],
  ['#10B981', '#34D399'],
  ['#F59E0B', '#FBBF24'],
  ['#EC4899', '#F472B6'],
  ['#3B82F6', '#60A5FA'],
  ['#8B5CF6', '#A78BFA'],
  ['#14B8A6', '#2DD4BF'],
]

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
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [activeTab, setActiveTab] = useState<
    'featured' | 'bestsellers' | 'new'
  >('featured')

  const fetchData = async () => {
    try {
      const [categoriesRes, featuredRes, newRes, brandsRes, blogRes] =
        await Promise.all([
          categoriesApi.getAll(),
          productsApi.getFeatured(8),
          productsApi.getNewArrivals(8),
          brandsApi.getAll(),
          blogApi.getFeaturedPosts(4),
        ])

      setCategories(categoriesRes.slice(0, 10))
      setFeaturedProducts(featuredRes)
      setFlashDeals(featuredRes.slice(0, 8))
      setNewArrivals(newRes)
      setBrands(brandsRes.slice(0, 8))
      setBlogPosts(blogRes)
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

        {/* Blog Section */}
        {blogPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title='From Our Blog'
              icon='newspaper-outline'
              onAction={() => router.push('/blog')}
            />
            <FlatList
              horizontal
              data={blogPosts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.blogCard}
                  onPress={() => router.push(`/blog/${item.slug}`)}
                  activeOpacity={0.9}
                >
                  <View style={styles.blogImageContainer}>
                    {item.featured_image_url ? (
                      <Image
                        source={{ uri: item.featured_image_url }}
                        style={styles.blogImage}
                        resizeMode='cover'
                      />
                    ) : (
                      <View
                        style={[styles.blogImage, styles.blogImagePlaceholder]}
                      >
                        <Ionicons
                          name='document-text'
                          size={24}
                          color={AppColors.gray400}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.blogContent}>
                    {item.category && (
                      <Text style={styles.blogCategory}>
                        {item.category.name}
                      </Text>
                    )}
                    <Text style={styles.blogTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.blogMeta}>
                      <Ionicons
                        name='time-outline'
                        size={12}
                        color={AppColors.gray400}
                      />
                      <Text style={styles.blogMetaText}>
                        {item.reading_time_minutes} min read
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => (
                <View style={{ width: AppSpacing.md }} />
              )}
            />
          </View>
        )}

        {/* Brand Showcase - Premium Design */}
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
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.premiumBrandCard}
                onPress={() => router.push(`/products?brand=${item.slug}`)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={BRAND_GRADIENTS[index % BRAND_GRADIENTS.length]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.premiumBrandGradient}
                >
                  {item.logo_url ? (
                    <View style={styles.premiumBrandLogoContainer}>
                      <Image
                        source={{ uri: item.logo_url }}
                        style={styles.premiumBrandLogo}
                        resizeMode='contain'
                      />
                    </View>
                  ) : (
                    <View style={styles.premiumBrandInitialContainer}>
                      <Text style={styles.premiumBrandInitial}>
                        {item.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.premiumBrandInfo}>
                    <Text style={styles.premiumBrandName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.premiumBrandArrow}>
                      <Ionicons
                        name='arrow-forward'
                        size={12}
                        color='rgba(255,255,255,0.8)'
                      />
                    </View>
                  </View>
                  {/* Decorative element */}
                  <View style={styles.premiumBrandDecor} />
                </LinearGradient>
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
    marginBottom: 100,
  },
  horizontalList: {
    paddingHorizontal: AppSpacing.base,
  },
  promoBannersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    rowGap: AppSpacing.sm,
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
  // Premium Brand Card Styles
  premiumBrandCard: {
    width: 140,
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  premiumBrandGradient: {
    flex: 1,
    padding: AppSpacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  premiumBrandLogoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    marginBottom: AppSpacing.xs,
  },
  premiumBrandLogo: {
    width: '100%',
    height: '100%',
  },
  premiumBrandInitialContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.xs,
  },
  premiumBrandInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
  premiumBrandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumBrandName: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.white,
    flex: 1,
  },
  premiumBrandArrow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBrandDecor: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    bottom: -15,
    right: -15,
  },
  blogCard: {
    width: 200,
    backgroundColor: AppColors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  blogImageContainer: {
    width: '100%',
    height: 110,
  },
  blogImage: {
    width: '100%',
    height: '100%',
  },
  blogImagePlaceholder: {
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blogContent: {
    padding: AppSpacing.md,
  },
  blogCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  blogTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray900,
    lineHeight: 18,
    marginBottom: AppSpacing.xs,
  },
  blogMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blogMetaText: {
    fontSize: 11,
    color: AppColors.gray400,
  },
})

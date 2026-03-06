// ============================================
// TechTools Mobile App - Blog List Screen
// ============================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppGradients,
  AppShadows,
} from '@/constants/appTheme'
import { blogApi } from '@/api'
import { BlogPost, BlogCategory, Pagination } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width - AppSpacing.base * 2

// Format date helper
function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Featured Blog Card Component
function FeaturedPostCard({
  post,
  onPress,
}: {
  post: BlogPost
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={styles.featuredCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.featuredImageContainer}>
        {post.featured_image_url ? (
          <Image
            source={{ uri: post.featured_image_url }}
            style={styles.featuredImage}
            resizeMode='cover'
          />
        ) : (
          <LinearGradient
            colors={AppGradients.primary}
            style={styles.featuredImage}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.featuredOverlay}
        />
      </View>
      <View style={styles.featuredContent}>
        <View style={styles.featuredBadges}>
          <View style={styles.featuredBadge}>
            <Ionicons name='flame' size={12} color={AppColors.white} />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
          {post.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{post.category.name}</Text>
            </View>
          )}
        </View>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt && (
          <Text style={styles.featuredExcerpt} numberOfLines={2}>
            {post.excerpt}
          </Text>
        )}
        <View style={styles.featuredMeta}>
          {post.author && (
            <View style={styles.authorInfo}>
              {post.author.avatar_url ? (
                <Image
                  source={{ uri: post.author.avatar_url }}
                  style={styles.authorAvatar}
                />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Text style={styles.authorAvatarText}>
                    {post.author.display_name.charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={styles.authorName}>{post.author.display_name}</Text>
            </View>
          )}
          <View style={styles.metaInfo}>
            <Ionicons name='time-outline' size={14} color={AppColors.gray300} />
            <Text style={styles.metaText}>{post.reading_time_minutes} min</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// Blog Post Card Component
function BlogPostCard({
  post,
  onPress,
}: {
  post: BlogPost
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={styles.postCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.postImageContainer}>
        {post.featured_image_url ? (
          <Image
            source={{ uri: post.featured_image_url }}
            style={styles.postImage}
            resizeMode='cover'
          />
        ) : (
          <LinearGradient
            colors={['#F3F4F6', '#E5E7EB']}
            style={styles.postImage}
          >
            <Ionicons
              name='document-text'
              size={32}
              color={AppColors.gray400}
            />
          </LinearGradient>
        )}
      </View>
      <View style={styles.postContent}>
        {post.category && (
          <Text style={styles.postCategory}>{post.category.name}</Text>
        )}
        <Text style={styles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt && (
          <Text style={styles.postExcerpt} numberOfLines={2}>
            {post.excerpt}
          </Text>
        )}
        <View style={styles.postMeta}>
          <View style={styles.postMetaItem}>
            <Ionicons
              name='calendar-outline'
              size={14}
              color={AppColors.gray400}
            />
            <Text style={styles.postMetaText}>
              {formatDate(post.published_at)}
            </Text>
          </View>
          <View style={styles.postMetaItem}>
            <Ionicons name='time-outline' size={14} color={AppColors.gray400} />
            <Text style={styles.postMetaText}>
              {post.reading_time_minutes} min read
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// Category Filter Chip
function CategoryChip({
  category,
  isSelected,
  onPress,
}: {
  category: BlogCategory | { id: string; name: string; slug: string }
  isSelected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.categoryChipText,
          isSelected && styles.categoryChipTextActive,
        ]}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  )
}

export default function BlogListScreen() {
  const router = useRouter()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchData = async (reset = false) => {
    try {
      const page = reset ? 1 : pagination.page

      const [postsResult, categoriesResult] = await Promise.all([
        blogApi.getPosts({
          page,
          limit: 10,
          category: selectedCategory || undefined,
          search: debouncedSearch || undefined,
        }),
        reset ? blogApi.getCategories() : Promise.resolve(categories),
      ])

      if (reset) {
        setCategories(categoriesResult)
        // Get featured posts on initial load
        const featured = await blogApi.getFeaturedPosts(3)
        setFeaturedPosts(featured)
      }

      if (reset) {
        setPosts(postsResult.posts)
      } else {
        setPosts((prev) => [...prev, ...postsResult.posts])
      }
      setPagination(postsResult.pagination)
    } catch (error) {
      console.error('Error fetching blog data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchData(true)
  }, [])

  useEffect(() => {
    setLoading(true)
    setPagination((prev) => ({ ...prev, page: 1 }))
    fetchData(true)
  }, [selectedCategory, debouncedSearch])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchData(true)
  }, [selectedCategory, debouncedSearch])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || pagination.page >= pagination.totalPages) return
    setLoadingMore(true)
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
    fetchData(false)
  }, [loadingMore, pagination])

  const navigateToPost = (slug: string) => {
    router.push(`/blog/${slug}` as any)
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  const renderHeader = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name='search-outline' size={20} color={AppColors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder='Search articles...'
          placeholderTextColor={AppColors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType='search'
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Ionicons name='close-circle' size={20} color={AppColors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContainer}
      >
        <CategoryChip
          category={{ id: 'all', name: 'All', slug: 'all' }}
          isSelected={!selectedCategory}
          onPress={() => setSelectedCategory(null)}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            isSelected={selectedCategory === category.slug}
            onPress={() =>
              setSelectedCategory(
                selectedCategory === category.slug ? null : category.slug,
              )
            }
          />
        ))}
      </ScrollView>

      {/* Featured Posts */}
      {featuredPosts.length > 0 && !searchQuery && !selectedCategory && (
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Featured Stories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            snapToInterval={CARD_WIDTH + AppSpacing.md}
            decelerationRate='fast'
            contentContainerStyle={styles.featuredScroll}
          >
            {featuredPosts.map((post) => (
              <FeaturedPostCard
                key={post.id}
                post={post}
                onPress={() => navigateToPost(post.slug)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Latest Posts Header */}
      <Text style={styles.sectionTitle}>
        {searchQuery
          ? `Results for "${searchQuery}"`
          : selectedCategory
          ? `${
              categories.find((c) => c.slug === selectedCategory)?.name ||
              'Category'
            } Articles`
          : 'Latest Articles'}
      </Text>
    </>
  )

  const renderFooter = () => {
    if (!loadingMore) return null
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size='small' color={AppColors.primary} />
      </View>
    )
  }

  const renderEmpty = () => {
    if (loading) return null
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name='document-text-outline'
          size={64}
          color={AppColors.gray300}
        />
        <Text style={styles.emptyTitle}>No articles found</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? 'Try different keywords or browse categories'
            : 'Check back later for new content'}
        </Text>
      </View>
    )
  }

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blog</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading articles...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blog</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BlogPostCard post={item} onPress={() => navigateToPost(item.slug)} />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={AppColors.primary}
            colors={[AppColors.primary]}
          />
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray50,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: AppColors.gray500,
  },
  listContent: {
    paddingBottom: AppSpacing.xl,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    paddingHorizontal: AppSpacing.base,
    margin: AppSpacing.base,
    height: 48,
    ...AppShadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: AppSpacing.sm,
    fontSize: 15,
    color: AppColors.gray900,
  },
  categoriesScroll: {
    marginBottom: AppSpacing.base,
  },
  categoriesContainer: {
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  categoryChip: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    marginRight: AppSpacing.sm,
  },
  categoryChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray600,
  },
  categoryChipTextActive: {
    color: AppColors.white,
  },
  featuredSection: {
    marginBottom: AppSpacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
    paddingHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.md,
  },
  featuredScroll: {
    paddingHorizontal: AppSpacing.base,
  },
  featuredCard: {
    width: CARD_WIDTH,
    borderRadius: AppBorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: AppColors.gray900,
    marginRight: AppSpacing.md,
    ...AppShadows.lg,
  },
  featuredImageContainer: {
    height: 200,
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: AppSpacing.base,
  },
  featuredBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.full,
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.white,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.full,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: AppColors.white,
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.white,
    marginBottom: AppSpacing.xs,
  },
  featuredExcerpt: {
    fontSize: 13,
    color: AppColors.gray300,
    lineHeight: 18,
    marginBottom: AppSpacing.sm,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.white,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '500',
    color: AppColors.white,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: AppColors.gray300,
  },
  postCard: {
    flexDirection: 'row',
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.md,
    overflow: 'hidden',
    ...AppShadows.sm,
  },
  postImageContainer: {
    width: 120,
    height: 120,
  },
  postImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postContent: {
    flex: 1,
    padding: AppSpacing.md,
    justifyContent: 'space-between',
  },
  postCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.gray900,
    lineHeight: 20,
    marginBottom: 4,
  },
  postExcerpt: {
    fontSize: 12,
    color: AppColors.gray500,
    lineHeight: 16,
    marginBottom: AppSpacing.sm,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  postMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postMetaText: {
    fontSize: 11,
    color: AppColors.gray400,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AppSpacing['4xl'],
    paddingHorizontal: AppSpacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray700,
    marginTop: AppSpacing.base,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray500,
    textAlign: 'center',
    marginTop: AppSpacing.sm,
  },
  loadingMore: {
    paddingVertical: AppSpacing.lg,
    alignItems: 'center',
  },
})

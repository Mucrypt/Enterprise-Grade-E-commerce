// ============================================
// TechTools Mobile App - Blog Post Detail Screen
// ============================================

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import RenderHtml from 'react-native-render-html'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppGradients,
  AppShadows,
} from '@/constants/appTheme'
import { blogApi } from '@/api'
import { BlogPost } from '@/types'

// Format date helper
function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Related Post Card
function RelatedPostCard({
  post,
  onPress,
}: {
  post: BlogPost
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={styles.relatedCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.relatedImageContainer}>
        {post.featured_image_url ? (
          <Image
            source={{ uri: post.featured_image_url }}
            style={styles.relatedImage}
            resizeMode='cover'
          />
        ) : (
          <LinearGradient
            colors={['#F3F4F6', '#E5E7EB']}
            style={styles.relatedImage}
          >
            <Ionicons
              name='document-text'
              size={24}
              color={AppColors.gray400}
            />
          </LinearGradient>
        )}
      </View>
      <View style={styles.relatedContent}>
        {post.category && (
          <Text style={styles.relatedCategory}>{post.category.name}</Text>
        )}
        <Text style={styles.relatedTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.relatedMeta}>
          <Ionicons name='time-outline' size={12} color={AppColors.gray400} />
          <Text style={styles.relatedMetaText}>
            {post.reading_time_minutes} min read
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// Tag Chip
function TagChip({ tag }: { tag: { name: string; slug: string } }) {
  return (
    <View style={styles.tagChip}>
      <Text style={styles.tagText}>{tag.name}</Text>
    </View>
  )
}

export default function BlogPostDetailScreen() {
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { width } = useWindowDimensions()

  const [post, setPost] = useState<BlogPost | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return

      try {
        setLoading(true)
        const [postData, related] = await Promise.all([
          blogApi.getPostBySlug(slug),
          blogApi.getRelatedPosts(slug, 3),
        ])
        setPost(postData)
        setRelatedPosts(related)

        // Record the view
        blogApi.recordView(slug)
      } catch (error) {
        console.error('Error fetching blog post:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [slug])

  const handleShare = async () => {
    if (!post) return

    try {
      await Share.share({
        title: post.title,
        message: `Check out this article: ${post.title}`,
        url: `https://techtoolstore.com/blog/${post.slug}`,
      })
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked)
    // TODO: Implement bookmark persistence
  }

  const handleLike = () => {
    setIsLiked(!isLiked)
    // TODO: Implement like API call
  }

  const navigateToPost = (postSlug: string) => {
    router.push(`/blog/${postSlug}` as any)
  }

  // HTML rendering configuration
  const tagsStyles = {
    body: {
      color: AppColors.gray700,
      fontSize: 16,
      lineHeight: 26,
    },
    p: {
      marginBottom: 16,
    },
    h1: {
      color: AppColors.gray900,
      fontSize: 24,
      fontWeight: '700' as const,
      marginTop: 24,
      marginBottom: 12,
    },
    h2: {
      color: AppColors.gray900,
      fontSize: 20,
      fontWeight: '700' as const,
      marginTop: 20,
      marginBottom: 10,
    },
    h3: {
      color: AppColors.gray900,
      fontSize: 18,
      fontWeight: '600' as const,
      marginTop: 16,
      marginBottom: 8,
    },
    a: {
      color: AppColors.primary,
      textDecorationLine: 'none' as const,
    },
    strong: {
      fontWeight: '600' as const,
    },
    blockquote: {
      backgroundColor: AppColors.gray50,
      borderLeftWidth: 4,
      borderLeftColor: AppColors.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginVertical: 16,
      fontStyle: 'italic' as const,
    },
    ul: {
      marginBottom: 16,
    },
    ol: {
      marginBottom: 16,
    },
    li: {
      marginBottom: 8,
    },
    img: {
      borderRadius: 12,
      marginVertical: 16,
    },
    code: {
      backgroundColor: AppColors.gray100,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    pre: {
      backgroundColor: AppColors.gray900,
      padding: 16,
      borderRadius: 12,
      marginVertical: 16,
      overflow: 'hidden' as const,
    },
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <View style={styles.headerButton} />
            <View style={styles.headerButton} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={AppColors.primary} />
          <Text style={styles.loadingText}>Loading article...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
          </TouchableOpacity>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons
            name='alert-circle-outline'
            size={64}
            color={AppColors.gray300}
          />
          <Text style={styles.errorTitle}>Article not found</Text>
          <Text style={styles.errorText}>
            The article you're looking for doesn't exist or has been removed.
          </Text>
          <TouchableOpacity
            style={styles.backToListButton}
            onPress={() => router.push('/blog' as any)}
          >
            <Text style={styles.backToListText}>Browse Articles</Text>
          </TouchableOpacity>
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleBookmark}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isBookmarked ? AppColors.primary : AppColors.gray700}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons
              name='share-outline'
              size={22}
              color={AppColors.gray700}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Featured Image */}
        {post.featured_image_url && (
          <View style={styles.featuredImageContainer}>
            <Image
              source={{ uri: post.featured_image_url }}
              style={styles.featuredImage}
              resizeMode='cover'
            />
          </View>
        )}

        <View style={styles.contentContainer}>
          {/* Category & Reading Time */}
          <View style={styles.metaRow}>
            {post.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{post.category.name}</Text>
              </View>
            )}
            <View style={styles.readingTime}>
              <Ionicons
                name='time-outline'
                size={14}
                color={AppColors.gray500}
              />
              <Text style={styles.readingTimeText}>
                {post.reading_time_minutes} min read
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{post.title}</Text>

          {/* Author & Date */}
          <View style={styles.authorRow}>
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
                <View>
                  <Text style={styles.authorName}>
                    {post.author.display_name}
                  </Text>
                  <Text style={styles.dateText}>
                    {formatDate(post.published_at)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <TouchableOpacity style={styles.statItem} onPress={handleLike}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? AppColors.error : AppColors.gray500}
              />
              <Text
                style={[styles.statText, isLiked && { color: AppColors.error }]}
              >
                {post.like_count + (isLiked ? 1 : 0)}
              </Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Ionicons
                name='eye-outline'
                size={20}
                color={AppColors.gray500}
              />
              <Text style={styles.statText}>{post.view_count} views</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons
                name='chatbubble-outline'
                size={18}
                color={AppColors.gray500}
              />
              <Text style={styles.statText}>{post.comment_count}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.articleContent}>
            {post.content_html ? (
              <RenderHtml
                contentWidth={width - AppSpacing.base * 2}
                source={{ html: post.content_html }}
                tagsStyles={tagsStyles}
              />
            ) : (
              <Text style={styles.plainContent}>{post.content}</Text>
            )}
          </View>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsSectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {post.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </View>
            </View>
          )}

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedSectionTitle}>Related Articles</Text>
              {relatedPosts.map((relatedPost) => (
                <RelatedPostCard
                  key={relatedPost.id}
                  post={relatedPost}
                  onPress={() => navigateToPost(relatedPost.slug)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.white,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray50,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.gray700,
    marginTop: AppSpacing.base,
  },
  errorText: {
    fontSize: 14,
    color: AppColors.gray500,
    textAlign: 'center',
    marginTop: AppSpacing.sm,
  },
  backToListButton: {
    marginTop: AppSpacing.lg,
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.xl,
    paddingVertical: AppSpacing.md,
    borderRadius: AppBorderRadius.lg,
  },
  backToListText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.white,
  },
  scrollContent: {
    paddingBottom: AppSpacing['3xl'],
  },
  featuredImageContainer: {
    width: '100%',
    height: 250,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    padding: AppSpacing.base,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.md,
  },
  categoryBadge: {
    backgroundColor: `${AppColors.primary}15`,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppBorderRadius.full,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  readingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readingTimeText: {
    fontSize: 12,
    color: AppColors.gray500,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: AppColors.gray900,
    lineHeight: 34,
    marginBottom: AppSpacing.md,
  },
  authorRow: {
    marginBottom: AppSpacing.base,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  dateText: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: AppSpacing.md,
    marginBottom: AppSpacing.base,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppColors.gray100,
    gap: AppSpacing.xl,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  statText: {
    fontSize: 13,
    color: AppColors.gray500,
  },
  articleContent: {
    marginBottom: AppSpacing.xl,
  },
  plainContent: {
    fontSize: 16,
    lineHeight: 26,
    color: AppColors.gray700,
  },
  tagsSection: {
    marginBottom: AppSpacing.xl,
  },
  tagsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.gray900,
    marginBottom: AppSpacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  tagChip: {
    backgroundColor: AppColors.gray100,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppBorderRadius.full,
  },
  tagText: {
    fontSize: 12,
    color: AppColors.gray600,
    fontWeight: '500',
  },
  relatedSection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    paddingTop: AppSpacing.xl,
  },
  relatedSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.base,
  },
  relatedCard: {
    flexDirection: 'row',
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: AppSpacing.md,
  },
  relatedImageContainer: {
    width: 100,
    height: 100,
  },
  relatedImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedContent: {
    flex: 1,
    padding: AppSpacing.md,
    justifyContent: 'center',
  },
  relatedCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray900,
    lineHeight: 18,
    marginBottom: 4,
  },
  relatedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  relatedMetaText: {
    fontSize: 11,
    color: AppColors.gray400,
  },
})

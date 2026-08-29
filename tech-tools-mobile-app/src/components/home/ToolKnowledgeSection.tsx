// ============================================
// Tool Guides & Workshop Knowledge
//
// Mirrors e-commerce-web-store/src/components/home/ToolKnowledgeSection.tsx.
// Uses the existing real blog API only (blogApi.getPosts). Renders
// nothing when there is no real published content -- matching the
// honest-empty-state pattern used elsewhere on this home screen. No
// placeholder blog content is ever fabricated.
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { homepageConfig } from '@/config/homepageConfig'
import { blogApi } from '@/api'
import { BlogPost } from '@/types'
import { formatDate } from '@/utils'

export default function ToolKnowledgeSection() {
  const router = useRouter()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      try {
        const data = await blogApi.getPosts({
          limit: homepageConfig.knowledge.displayLimit,
        })
        if (cancelled) return
        setPosts(
          (data.posts || []).filter(
            (post) =>
              post.status === 'published' && post.visibility === 'public',
          ),
        )
      } catch (error) {
        console.error('Failed to load tool guides:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPosts()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && posts.length === 0) return null

  const { heading, description } = homepageConfig.knowledge

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.list}>
          {[...Array(homepageConfig.knowledge.displayLimit)].map((_, i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/blog/${post.slug}` as never)}
            >
              {post.featured_image_url && (
                <Image
                  source={{ uri: post.featured_image_url }}
                  style={styles.cardImage}
                  resizeMode='cover'
                />
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                {!!post.excerpt && (
                  <Text style={styles.cardExcerpt} numberOfLines={3}>
                    {post.excerpt}
                  </Text>
                )}
                <View style={styles.cardMeta}>
                  {!!post.author?.display_name && (
                    <Text style={styles.cardMetaText}>
                      {post.author.display_name}
                    </Text>
                  )}
                  {!!post.author?.display_name && !!post.published_at && (
                    <Text style={styles.cardMetaDot}>·</Text>
                  )}
                  {!!post.published_at && (
                    <Text style={styles.cardMetaText}>
                      {formatDate(post.published_at)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => router.push(homepageConfig.routes.blog as never)}
      >
        <Text style={styles.viewAllText}>View All Guides</Text>
        <Ionicons name='arrow-forward' size={16} color={AppColors.gray900} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: AppColors.background,
    borderTopWidth: 1,
    borderTopColor: AppColors.slate200,
    paddingVertical: AppSpacing['2xl'],
    paddingHorizontal: AppSpacing.base,
  },
  headerRow: {},
  headerText: {},
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: AppColors.gray900,
    letterSpacing: -0.3,
  },
  description: {
    marginTop: AppSpacing.sm,
    fontSize: 14,
    color: AppColors.slate500,
    lineHeight: 20,
  },
  list: {
    marginTop: AppSpacing.xl,
    gap: AppSpacing.base,
  },
  skeletonCard: {
    height: 140,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray100,
  },
  card: {
    borderWidth: 1,
    borderColor: AppColors.slate200,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.white,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardImage: {
    width: 96,
    height: 96,
    backgroundColor: AppColors.gray100,
  },
  cardContent: {
    flex: 1,
    padding: AppSpacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray900,
    lineHeight: 19,
  },
  cardExcerpt: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.slate500,
  },
  cardMeta: {
    marginTop: AppSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 11,
    color: AppColors.slate500,
  },
  cardMetaDot: {
    fontSize: 11,
    color: AppColors.slate500,
  },
  viewAllButton: {
    marginTop: AppSpacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.gray900,
  },
})

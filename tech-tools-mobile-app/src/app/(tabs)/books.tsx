// ============================================
// TechTools Mobile App - Books Tab Screen
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing } from '@/constants/appTheme'
import { booksApi } from '@/api'
import type { Book } from '@/types'

const extractBooks = (payload: unknown): Book[] => {
  const data = payload as
    | {
        books?: Book[]
        items?: Book[]
        data?: Book[]
      }
    | undefined

  return data?.books || data?.items || data?.data || []
}

export default function BooksTabScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [books, setBooks] = useState<Book[]>([])
  const [selectedFormat, setSelectedFormat] = useState('all')

  const fetchData = useCallback(async () => {
    try {
      const response = await booksApi.getAll({ limit: 16 })
      setBooks(extractBooks(response))
    } catch (error) {
      console.error('Error fetching books data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  const formatOptions = useMemo(() => {
    const formats = new Set<string>()
    books.forEach((book) => {
      ;(book.available_formats || book.availableFormats || []).forEach(
        (format) => formats.add(format),
      )
    })
    return ['all', ...Array.from(formats)]
  }, [books])

  const featuredBooks = useMemo(() => books.slice(0, 4), [books])
  const highlightedBook = featuredBooks[0]

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const formats = book.available_formats || book.availableFormats || []
      return selectedFormat === 'all' || formats.includes(selectedFormat)
    })
  }, [books, selectedFormat])

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
        <LinearGradient
          colors={['#0F172A', '#111827', '#C2410C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Ionicons name='book-outline' size={14} color={AppColors.white} />
            <Text style={styles.heroBadgeText}>Books marketplace</Text>
          </View>
          <Text style={styles.heroTitle}>
            Creator-powered books, ready for mobile reading.
          </Text>
          <Text style={styles.heroSubtitle}>
            Browse digital releases, open sample previews, and move faster from
            discovery to purchase-ready intent.
          </Text>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() =>
              highlightedBook
                ? router.push(`/book/${highlightedBook.id}` as Href)
                : undefined
            }
            disabled={!highlightedBook}
          >
            <Text style={styles.heroButtonText}>Read featured book</Text>
            <Ionicons name='arrow-forward' size={16} color={AppColors.white} />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formats</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {formatOptions.map((format) => (
              <TouchableOpacity
                key={format}
                style={[
                  styles.chip,
                  selectedFormat === format && styles.chipActive,
                ]}
                onPress={() => setSelectedFormat(format)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedFormat === format && styles.chipTextActive,
                  ]}
                >
                  {format === 'all' ? 'All formats' : format}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {featuredBooks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured titles</Text>
            <FlatList
              horizontal
              data={featuredBooks}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.featuredCard}
                  onPress={() => router.push(`/book/${item.id}` as Href)}
                >
                  <View style={styles.coverWrap}>
                    {item.cover_image_url || item.coverImageUrl ? (
                      <Image
                        source={{
                          uri: item.cover_image_url || item.coverImageUrl || '',
                        }}
                        style={styles.coverImage}
                      />
                    ) : (
                      <LinearGradient
                        colors={['#0F172A', '#C2410C']}
                        style={styles.coverFallback}
                      >
                        <Ionicons
                          name='book'
                          size={28}
                          color={AppColors.white}
                        />
                      </LinearGradient>
                    )}
                  </View>
                  <Text style={styles.featuredTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.featuredAuthor} numberOfLines={1}>
                    {item.author_name || item.authorName || 'Editorial team'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All books</Text>
          <View style={styles.grid}>
            {filteredBooks.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.gridCard}
                onPress={() => router.push(`/book/${item.id}` as Href)}
                activeOpacity={0.9}
              >
                <View style={styles.gridCoverWrap}>
                  {item.cover_image_url || item.coverImageUrl ? (
                    <Image
                      source={{
                        uri: item.cover_image_url || item.coverImageUrl || '',
                      }}
                      style={styles.gridCover}
                    />
                  ) : (
                    <LinearGradient
                      colors={['#111827', '#C2410C']}
                      style={styles.gridCoverFallback}
                    >
                      <Ionicons name='book' size={22} color={AppColors.white} />
                    </LinearGradient>
                  )}
                </View>
                <Text style={styles.gridTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.gridMeta} numberOfLines={1}>
                  {item.author_name || item.authorName || 'Editorial team'}
                </Text>
                <View style={styles.gridFooter}>
                  <Text style={styles.gridPrice}>
                    {item.price != null
                      ? `$${Number(item.price).toFixed(2)}`
                      : 'Sample'}
                  </Text>
                  <Ionicons
                    name='chevron-forward'
                    size={14}
                    color={AppColors.gray400}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
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
  hero: {
    margin: AppSpacing.base,
    borderRadius: 32,
    padding: AppSpacing.xl,
    overflow: 'hidden',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: AppSpacing.md,
  },
  heroBadgeText: {
    color: AppColors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: AppColors.white,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    marginTop: AppSpacing.sm,
    fontSize: 14,
    lineHeight: 22,
  },
  heroButton: {
    marginTop: AppSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  heroButtonText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginTop: AppSpacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.gray900,
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.md,
  },
  chipsRow: {
    paddingHorizontal: AppSpacing.base,
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: AppColors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  chipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: {
    color: AppColors.gray600,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: AppColors.white,
  },
  featuredList: {
    paddingHorizontal: AppSpacing.base,
    gap: AppSpacing.md,
  },
  featuredCard: {
    width: 170,
    backgroundColor: AppColors.white,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.gray100,
  },
  coverWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    aspectRatio: 0.78,
    marginBottom: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  featuredAuthor: {
    marginTop: 4,
    fontSize: 12,
    color: AppColors.gray500,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    rowGap: AppSpacing.md,
  },
  gridCard: {
    width: '48%',
    backgroundColor: AppColors.white,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.gray100,
  },
  gridCoverWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    aspectRatio: 0.72,
    marginBottom: 10,
  },
  gridCover: {
    width: '100%',
    height: '100%',
  },
  gridCoverFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  gridMeta: {
    marginTop: 4,
    fontSize: 11,
    color: AppColors.gray500,
  },
  gridFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  bottomSpacer: {
    height: 120,
  },
})

// ============================================
// TechTools Mobile App - Book Detail Screen
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { booksApi } from '@/api'
import type { Book, BookSampleAccess } from '@/types'

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [book, setBook] = useState<Book | null>(null)
  const [sampleAccess, setSampleAccess] = useState<BookSampleAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const bookData = await booksApi.getById(id as string)
        setBook(bookData)

        try {
          const sample = await booksApi.getSampleAccess(id as string)
          setSampleAccess(
            (sample as { access?: BookSampleAccess })?.access ||
              (sample as BookSampleAccess),
          )
        } catch {
          setSampleAccess(null)
        }
      } catch (error) {
        console.error('Error fetching book:', error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchBook()
    }
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons
          name='alert-circle-outline'
          size={64}
          color={AppColors.gray300}
        />
        <Text style={styles.errorTitle}>Book not found</Text>
        <Text style={styles.errorText}>
          The title you selected is not available yet.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const formats = book.available_formats || book.availableFormats || []
  const author = book.author_name || book.authorName || 'Editorial team'
  const cover = book.cover_image_url || book.coverImageUrl

  const openSample = async () => {
    const sampleUrl =
      sampleAccess?.accessUrl ||
      sampleAccess?.access_url ||
      book.sample_url ||
      book.sampleUrl

    if (sampleUrl) {
      await Linking.openURL(sampleUrl)
    }
  }

  const hasSample = Boolean(
    sampleAccess?.accessUrl ||
      sampleAccess?.access_url ||
      book.sample_url ||
      book.sampleUrl,
  )

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Book details
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <LinearGradient
            colors={['#0F172A', '#111827', '#C2410C']}
            style={styles.coverShell}
          >
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={styles.coverImage}
                resizeMode='cover'
              />
            ) : (
              <View style={styles.coverFallback}>
                <Ionicons name='book' size={48} color={AppColors.white} />
                <Text style={styles.coverFallbackText}>Digital release</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.contentCard}>
            <View style={styles.badge}>
              <Ionicons name='sparkles' size={14} color={AppColors.white} />
              <Text style={styles.badgeText}>Featured release</Text>
            </View>

            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>By {author}</Text>

            <View style={styles.formatRow}>
              {formats.map((format) => (
                <View key={format} style={styles.formatChip}>
                  <Text style={styles.formatChipText}>{format}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.description}>
              {book.description ||
                book.excerpt ||
                'Open the sample preview and move from curiosity to conversion.'}
            </Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Sample</Text>
                <Text style={styles.infoValue}>Ready</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Formats</Text>
                <Text style={styles.infoValue}>{formats.length || 1}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openSample}
              disabled={!hasSample}
            >
              <Ionicons name='download-outline' size={18} color={AppColors.white} />
              <Text style={styles.primaryButtonText}>Open sample</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Back to catalog</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSpacing.xl,
    backgroundColor: AppColors.background,
  },
  errorTitle: {
    marginTop: AppSpacing.md,
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  errorText: {
    marginTop: AppSpacing.sm,
    color: AppColors.gray600,
    textAlign: 'center',
  },
  backButton: {
    marginTop: AppSpacing.lg,
    borderRadius: 999,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: AppColors.white,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.white,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: AppSpacing.sm,
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.gray900,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  coverShell: {
    marginHorizontal: AppSpacing.base,
    marginTop: AppSpacing.sm,
    borderRadius: 32,
    overflow: 'hidden',
    aspectRatio: 0.78,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    marginTop: AppSpacing.sm,
    color: AppColors.white,
    fontWeight: '700',
  },
  contentCard: {
    marginHorizontal: AppSpacing.base,
    marginTop: AppSpacing.lg,
    borderRadius: 32,
    backgroundColor: AppColors.white,
    padding: AppSpacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: AppSpacing.md,
  },
  badgeText: {
    color: AppColors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: AppColors.gray900,
  },
  author: {
    marginTop: AppSpacing.sm,
    fontSize: 15,
    color: AppColors.gray500,
  },
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: AppSpacing.md,
  },
  formatChip: {
    borderRadius: 999,
    backgroundColor: AppColors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formatChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.gray700,
    textTransform: 'capitalize',
  },
  description: {
    marginTop: AppSpacing.lg,
    fontSize: 15,
    lineHeight: 24,
    color: AppColors.gray600,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: AppSpacing.lg,
  },
  infoCard: {
    flex: 1,
    borderRadius: AppBorderRadius.lg,
    backgroundColor: AppColors.gray100,
    padding: AppSpacing.md,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  primaryButton: {
    marginTop: AppSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: AppSpacing.md,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    backgroundColor: AppColors.white,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: AppColors.gray800,
    fontWeight: '700',
  },
})
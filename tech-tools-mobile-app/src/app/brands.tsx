// ============================================
// TechTools Mobile App - Brands Screen (World-Class Design)
// ============================================

import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  Platform,
  SectionList,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import { brandsApi } from '@/api'
import { Brand } from '@/types'

const { width, height } = Dimensions.get('window')

// Premium gradient colors
const BRAND_GRADIENTS: [string, string][] = [
  ['#FF6B35', '#FF8F6B'],
  ['#6366F1', '#8B5CF6'],
  ['#10B981', '#34D399'],
  ['#F59E0B', '#FBBF24'],
  ['#EC4899', '#F472B6'],
  ['#3B82F6', '#60A5FA'],
  ['#8B5CF6', '#A78BFA'],
  ['#14B8A6', '#2DD4BF'],
  ['#EF4444', '#F87171'],
  ['#84CC16', '#A3E635'],
]

function getBrandGradient(name: string): [string, string] {
  const charCode = name.charCodeAt(0)
  return BRAND_GRADIENTS[charCode % BRAND_GRADIENTS.length]
}

// Alphabet for navigation
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface BrandSection {
  title: string
  data: Brand[]
}

// Premium Spotlight Brand Card
function SpotlightBrandCard({
  brand,
  onPress,
  rank,
}: {
  brand: Brand
  onPress: () => void
  rank: number
}) {
  const gradient = getBrandGradient(brand.name)

  return (
    <TouchableOpacity
      style={styles.spotlightCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.spotlightGradient}
      >
        {/* Rank Badge */}
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>

        {/* Brand Logo/Initial */}
        <View style={styles.spotlightLogoContainer}>
          {brand.logo_url ? (
            <Image
              source={{ uri: brand.logo_url }}
              style={styles.spotlightLogo}
              resizeMode='contain'
            />
          ) : (
            <Text style={styles.spotlightInitial}>{brand.name.charAt(0)}</Text>
          )}
        </View>

        {/* Brand Info */}
        <Text style={styles.spotlightName} numberOfLines={1}>
          {brand.name}
        </Text>

        {/* Premium Badge */}
        <View style={styles.premiumBadge}>
          <Ionicons name='checkmark-circle' size={12} color='#FCD34D' />
          <Text style={styles.premiumBadgeText}>Verified</Text>
        </View>

        {/* Decorative elements */}
        <View style={styles.spotlightDecor1} />
        <View style={styles.spotlightDecor2} />
      </LinearGradient>
    </TouchableOpacity>
  )
}

// Premium List Brand Card
function BrandListCard({
  brand,
  onPress,
  index,
}: {
  brand: Brand
  onPress: () => void
  index: number
}) {
  const gradient = getBrandGradient(brand.name)

  return (
    <TouchableOpacity
      style={styles.listCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Brand Logo */}
      <View style={styles.listLogoWrapper}>
        {brand.logo_url ? (
          <View style={styles.listLogoContainer}>
            <Image
              source={{ uri: brand.logo_url }}
              style={styles.listLogo}
              resizeMode='contain'
            />
          </View>
        ) : (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.listLogoGradient}
          >
            <Text style={styles.listInitial}>{brand.name.charAt(0)}</Text>
          </LinearGradient>
        )}
      </View>

      {/* Brand Info */}
      <View style={styles.listInfo}>
        <View style={styles.listNameRow}>
          <Text style={styles.listName} numberOfLines={1}>
            {brand.name}
          </Text>
          {brand.is_active && (
            <View style={styles.verifiedIcon}>
              <Ionicons name='checkmark-circle' size={16} color='#10B981' />
            </View>
          )}
        </View>
        {brand.description ? (
          <Text style={styles.listDescription} numberOfLines={2}>
            {brand.description}
          </Text>
        ) : (
          <Text style={styles.listDescription} numberOfLines={1}>
            Premium automotive brand
          </Text>
        )}
        {/* Tags */}
        <View style={styles.tagContainer}>
          <View style={styles.tag}>
            <Ionicons name='star' size={10} color={AppColors.primary} />
            <Text style={styles.tagText}>Top Rated</Text>
          </View>
          <View style={[styles.tag, styles.tagSecondary]}>
            <Ionicons name='shield-checkmark' size={10} color='#10B981' />
            <Text style={[styles.tagText, styles.tagTextSecondary]}>
              Trusted
            </Text>
          </View>
        </View>
      </View>

      {/* Arrow */}
      <View style={styles.listArrow}>
        <Ionicons name='chevron-forward' size={20} color={AppColors.gray400} />
      </View>
    </TouchableOpacity>
  )
}

// Section Header Component
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionLetterHeader}>
      <LinearGradient
        colors={[AppColors.primary, '#FF8F6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.letterBadge}
      >
        <Text style={styles.letterText}>{title}</Text>
      </LinearGradient>
      <View style={styles.letterLine} />
    </View>
  )
}

// Alphabet Navigator Component
function AlphabetNavigator({
  activeLetters,
  onLetterPress,
  currentLetter,
}: {
  activeLetters: Set<string>
  onLetterPress: (letter: string) => void
  currentLetter: string | null
}) {
  return (
    <View style={styles.alphabetNav}>
      {ALPHABET.map((letter) => (
        <TouchableOpacity
          key={letter}
          style={[
            styles.alphabetLetter,
            activeLetters.has(letter) && styles.alphabetLetterActive,
            currentLetter === letter && styles.alphabetLetterCurrent,
          ]}
          onPress={() => activeLetters.has(letter) && onLetterPress(letter)}
          disabled={!activeLetters.has(letter)}
        >
          <Text
            style={[
              styles.alphabetLetterText,
              activeLetters.has(letter) && styles.alphabetLetterTextActive,
              currentLetter === letter && styles.alphabetLetterTextCurrent,
            ]}
          >
            {letter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function BrandsScreen() {
  const router = useRouter()
  const sectionListRef = useRef<SectionList>(null)
  const [loading, setLoading] = useState(true)
  const [brands, setBrands] = useState<Brand[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentLetter, setCurrentLetter] = useState<string | null>(null)

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const data = await brandsApi.getAll()
        setBrands(data)
      } catch (error) {
        console.error('Error fetching brands:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchBrands()
  }, [])

  // Group brands by first letter
  const { sections, activeLetters, spotlightBrands } = useMemo(() => {
    let filteredBrands = brands
    if (searchQuery.trim()) {
      filteredBrands = brands.filter((brand) =>
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Group by letter
    const grouped: { [key: string]: Brand[] } = {}
    filteredBrands.forEach((brand) => {
      const letter = brand.name.charAt(0).toUpperCase()
      if (!grouped[letter]) {
        grouped[letter] = []
      }
      grouped[letter].push(brand)
    })

    // Convert to sections
    const sectionData: BrandSection[] = Object.keys(grouped)
      .sort()
      .map((letter) => ({
        title: letter,
        data: grouped[letter],
      }))

    // Active letters for navigation
    const letters = new Set(Object.keys(grouped))

    // Top spotlight brands
    const spotlight = brands.slice(0, 5)

    return {
      sections: sectionData,
      activeLetters: letters,
      spotlightBrands: spotlight,
    }
  }, [brands, searchQuery])

  const handleLetterPress = (letter: string) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter)
    if (sectionIndex !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewOffset: 100,
      })
      setCurrentLetter(letter)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Fixed Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray900} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Brands</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{brands.length}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name='filter' size={22} color={AppColors.gray700} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name='search' size={20} color={AppColors.gray400} />
            <TextInput
              style={styles.searchInput}
              placeholder='Search brands...'
              placeholderTextColor={AppColors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons
                  name='close-circle'
                  size={20}
                  color={AppColors.gray400}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={() => (
              <>
                {/* Spotlight Section */}
                {!searchQuery && spotlightBrands.length > 0 && (
                  <View style={styles.spotlightSection}>
                    <View style={styles.spotlightHeader}>
                      <View style={styles.spotlightTitleRow}>
                        <Ionicons
                          name='trophy'
                          size={20}
                          color={AppColors.primary}
                        />
                        <Text style={styles.spotlightTitle}>Top Brands</Text>
                      </View>
                      <Text style={styles.spotlightSubtitle}>
                        Most popular this month
                      </Text>
                    </View>
                    <FlatList
                      horizontal
                      data={spotlightBrands}
                      keyExtractor={(item) => `spotlight-${item.id}`}
                      renderItem={({ item, index }) => (
                        <SpotlightBrandCard
                          brand={item}
                          rank={index + 1}
                          onPress={() =>
                            router.push(`/products?brand=${item.slug}`)
                          }
                        />
                      )}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.spotlightList}
                      ItemSeparatorComponent={() => (
                        <View style={{ width: 12 }} />
                      )}
                    />
                  </View>
                )}

                {/* All Brands Header */}
                <View style={styles.allBrandsHeader}>
                  <View style={styles.allBrandsHeaderLeft}>
                    <Ionicons name='apps' size={20} color={AppColors.primary} />
                    <Text style={styles.allBrandsTitle}>
                      {searchQuery ? 'Search Results' : 'All Brands'}
                    </Text>
                  </View>
                  <Text style={styles.allBrandsCount}>
                    {sections.reduce((acc, s) => acc + s.data.length, 0)} brands
                  </Text>
                </View>
              </>
            )}
            renderSectionHeader={({ section }) => (
              <SectionHeader title={section.title} />
            )}
            renderItem={({ item, index }) => (
              <BrandListCard
                brand={item}
                index={index}
                onPress={() => router.push(`/products?brand=${item.slug}`)}
              />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name='search-outline'
                    size={48}
                    color={AppColors.gray300}
                  />
                </View>
                <Text style={styles.emptyText}>No brands found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your search
                </Text>
              </View>
            )}
            ListFooterComponent={() => <View style={{ height: 100 }} />}
            onScrollToIndexFailed={() => {}}
          />

          {/* Alphabet Navigator */}
          {!searchQuery && (
            <AlphabetNavigator
              activeLetters={activeLetters}
              onLetterPress={handleLetterPress}
              currentLetter={currentLetter}
            />
          )}
        </View>
      </SafeAreaView>
    </>
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
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.background,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  headerBadge: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.white,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search Bar
  searchContainer: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    borderRadius: 12,
    paddingHorizontal: AppSpacing.md,
    height: 46,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  searchInput: {
    flex: 1,
    marginLeft: AppSpacing.sm,
    fontSize: 15,
    color: AppColors.gray900,
  },
  // Main Content
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  listContent: {
    paddingRight: 30, // Space for alphabet nav
  },
  // Spotlight Section
  spotlightSection: {
    paddingTop: AppSpacing.md,
    marginBottom: AppSpacing.lg,
  },
  spotlightHeader: {
    paddingHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.md,
  },
  spotlightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spotlightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  spotlightSubtitle: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: 2,
  },
  spotlightList: {
    paddingHorizontal: AppSpacing.base,
  },
  spotlightCard: {
    width: 150,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  spotlightGradient: {
    flex: 1,
    padding: AppSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.white,
  },
  spotlightLogoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  spotlightLogo: {
    width: 50,
    height: 50,
  },
  spotlightInitial: {
    fontSize: 30,
    fontWeight: '700',
    color: AppColors.primary,
  },
  spotlightName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.white,
  },
  spotlightDecor1: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -30,
    right: -30,
  },
  spotlightDecor2: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -15,
    left: -15,
  },
  // All Brands Header
  allBrandsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
  },
  allBrandsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allBrandsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  allBrandsCount: {
    fontSize: 13,
    color: AppColors.gray500,
  },
  // Section Letter Header
  sectionLetterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.background,
  },
  letterBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
  letterLine: {
    flex: 1,
    height: 1,
    backgroundColor: AppColors.gray200,
    marginLeft: AppSpacing.md,
  },
  // List Card
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.sm,
    padding: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  listLogoWrapper: {
    marginRight: AppSpacing.md,
  },
  listLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  listLogo: {
    width: '100%',
    height: '100%',
  },
  listLogoGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.white,
  },
  listInfo: {
    flex: 1,
  },
  listNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.gray900,
    flex: 1,
  },
  verifiedIcon: {
    // Styling for verified icon
  },
  listDescription: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: 2,
    lineHeight: 18,
  },
  tagContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${AppColors.primary}10`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagSecondary: {
    backgroundColor: '#10B98110',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.primary,
  },
  tagTextSecondary: {
    color: '#10B981',
  },
  listArrow: {
    marginLeft: AppSpacing.sm,
  },
  // Alphabet Navigator
  alphabetNav: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  alphabetLetter: {
    width: 20,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alphabetLetterActive: {
    // Active letter styling
  },
  alphabetLetterCurrent: {
    backgroundColor: AppColors.primary,
    borderRadius: 4,
  },
  alphabetLetterText: {
    fontSize: 10,
    fontWeight: '500',
    color: AppColors.gray300,
  },
  alphabetLetterTextActive: {
    color: AppColors.gray600,
    fontWeight: '600',
  },
  alphabetLetterTextCurrent: {
    color: AppColors.white,
    fontWeight: '700',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: AppSpacing.base,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  emptySubtext: {
    fontSize: 14,
    color: AppColors.gray500,
    marginTop: 4,
  },
})

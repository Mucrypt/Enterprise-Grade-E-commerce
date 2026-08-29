// ============================================
// TechTools Mobile App - Product Filter Bottom Sheet
// ============================================
// A real, data-driven filter bottom sheet for the product listing screen.
// Mirrors the web storefront's FilterSidebar.tsx dimension-for-dimension
// (category, brand, price, category-specific attributes, rating, in
// stock) and its ActiveFilterChips clear-all pattern, adapted to a
// SHEIN-style mobile bottom sheet: a scrollable, collapsible filter list
// with a sticky "Show N results" / "Apply filters" button pinned at the
// bottom. Built on core React Native `Modal` -- no bottom-sheet library is
// installed in this app (checked package.json), so a slide-up Modal +
// backdrop is the native-feeling option available without a rebuild.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Category, Brand, CategoryAttribute } from '@/types'
import { categoriesApi } from '@/api'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
} from '@/constants/appTheme'

// Same 5 ranges as the web storefront's FilterSidebar.tsx, verbatim.
export const PRICE_RANGES: { min: number; max?: number; label: string }[] = [
  { min: 0, max: 25, label: 'Under €25' },
  { min: 25, max: 50, label: '€25 - €50' },
  { min: 50, max: 100, label: '€50 - €100' },
  { min: 100, max: 200, label: '€100 - €200' },
  { min: 200, max: undefined, label: 'Over €200' },
]

// Same "N & Up" star options as the web storefront's FilterSidebar.tsx.
export const RATING_OPTIONS = [4, 3, 2, 1]

export interface ProductFilterState {
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  inStock?: boolean
  attributes?: Record<string, string>
}

export function countActiveFilters(f: ProductFilterState): number {
  let n = 0
  if (f.category) n++
  if (f.brand) n++
  if (f.minPrice !== undefined || f.maxPrice !== undefined) n++
  if (f.minRating) n++
  if (f.inStock) n++
  if (f.attributes) n += Object.keys(f.attributes).length
  return n
}

interface FilterSheetProps {
  visible: boolean
  onClose: () => void
  categories: Category[]
  brands: Brand[]
  filters: ProductFilterState
  onApply: (filters: ProductFilterState) => void
  /** Real backend count preview for the current draft filters (plus the
   * screen's own search/route context) -- powers the sticky "Show N
   * results" button. Never a guessed or interpolated number. */
  fetchPreviewCount: (filters: ProductFilterState) => Promise<number>
}

function FilterSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={AppColors.slate500}
        />
      </TouchableOpacity>
      {open && (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={styles.sectionBody}
        >
          {children}
        </Animated.View>
      )}
    </View>
  )
}

function OptionRow({
  label,
  selected,
  onPress,
  left,
}: {
  label: string
  selected: boolean
  onPress: () => void
  left?: React.ReactNode
}) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.optionRowLeft}>
        {left}
        <Text
          style={[styles.optionText, selected && styles.optionTextSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {selected && (
        <Ionicons name='checkmark' size={18} color={AppColors.primary} />
      )}
    </TouchableOpacity>
  )
}

function StarsRow({ count }: { count: number }) {
  return (
    <View style={styles.starsRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < count ? 'star' : 'star-outline'}
          size={14}
          color={AppColors.warning}
        />
      ))}
    </View>
  )
}

export default function FilterSheet({
  visible,
  onClose,
  categories,
  brands,
  filters,
  onApply,
  fetchPreviewCount,
}: FilterSheetProps) {
  const [draft, setDraft] = useState<ProductFilterState>(filters)
  const [categoryAttributes, setCategoryAttributes] = useState<
    CategoryAttribute[]
  >([])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevCategoryRef = useRef<string | undefined>(undefined)

  // Reset the draft to whatever is currently applied every time the sheet
  // opens, so a dismissed (not applied) edit never leaks into the next
  // open.
  useEffect(() => {
    if (visible) {
      setDraft(filters)
      prevCategoryRef.current = filters.category
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // Category-specific structured attributes -- only fetched while a
  // single category is selected in the draft, mirrors the web
  // storefront's activeCategoryId gating exactly. Switching category
  // drops any attribute selections from the previous category (their
  // names no longer apply to the new one).
  useEffect(() => {
    if (!visible) return
    if (prevCategoryRef.current !== draft.category) {
      prevCategoryRef.current = draft.category
      setDraft((d) => ({ ...d, attributes: undefined }))
    }
    if (!draft.category) {
      setCategoryAttributes([])
      return
    }
    const activeCategory = categories.find((c) => c.slug === draft.category)
    if (!activeCategory) {
      setCategoryAttributes([])
      return
    }
    let cancelled = false
    categoriesApi
      .getAttributes(activeCategory.id)
      .then((attrs) => {
        if (!cancelled) setCategoryAttributes(attrs)
      })
      .catch(() => {
        if (!cancelled) setCategoryAttributes([])
      })
    return () => {
      cancelled = true
    }
  }, [draft.category, categories, visible])

  const filterableAttributes = useMemo(
    () =>
      categoryAttributes.filter(
        (attr) =>
          attr.is_filterable &&
          attr.input_type === 'select' &&
          (attr.options?.length || 0) > 0,
      ),
    [categoryAttributes],
  )

  // Real, debounced backend count preview for the current draft -- never a
  // guessed/interpolated number.
  useEffect(() => {
    if (!visible) return
    setPreviewLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPreviewCount(draft)
        .then((count) => setPreviewCount(count))
        .catch(() => setPreviewCount(null))
        .finally(() => setPreviewLoading(false))
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, visible])

  const activeCount = countActiveFilters(draft)

  const toggleCategory = (slug: string) => {
    setDraft((d) => ({
      ...d,
      category: d.category === slug ? undefined : slug,
    }))
  }
  const toggleBrand = (slug: string) => {
    setDraft((d) => ({ ...d, brand: d.brand === slug ? undefined : slug }))
  }
  const togglePriceRange = (range: (typeof PRICE_RANGES)[number]) => {
    setDraft((d) => {
      const selected = d.minPrice === range.min && d.maxPrice === range.max
      if (selected) return { ...d, minPrice: undefined, maxPrice: undefined }
      return { ...d, minPrice: range.min, maxPrice: range.max }
    })
  }
  const toggleRating = (rating: number) => {
    setDraft((d) => ({
      ...d,
      minRating: d.minRating === rating ? undefined : rating,
    }))
  }
  const toggleAttribute = (name: string, option: string) => {
    setDraft((d) => {
      const current = d.attributes || {}
      const isSelected = current[name] === option
      const next = { ...current }
      if (isSelected) delete next[name]
      else next[name] = option
      return { ...d, attributes: Object.keys(next).length ? next : undefined }
    })
  }
  const toggleInStock = (value: boolean) => {
    setDraft((d) => ({ ...d, inStock: value || undefined }))
  }
  const handleClearAll = () => {
    setDraft({})
  }
  const handleApply = () => {
    onApply(draft)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdropWrap}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name='close' size={24} color={AppColors.gray700} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.bodyContent}
          >
            <FilterSection title='Category' defaultOpen>
              {categories.map((category) => (
                <OptionRow
                  key={category.id}
                  label={category.name}
                  selected={draft.category === category.slug}
                  onPress={() => toggleCategory(category.slug)}
                />
              ))}
              {categories.length === 0 && (
                <Text style={styles.emptyHint}>No categories available</Text>
              )}
            </FilterSection>

            <FilterSection title='Brand'>
              {brands.map((brand) => (
                <OptionRow
                  key={brand.id}
                  label={brand.name}
                  selected={draft.brand === brand.slug}
                  onPress={() => toggleBrand(brand.slug)}
                />
              ))}
              {brands.length === 0 && (
                <Text style={styles.emptyHint}>No brands available</Text>
              )}
            </FilterSection>

            <FilterSection title='Price' defaultOpen>
              {PRICE_RANGES.map((range) => (
                <OptionRow
                  key={range.label}
                  label={range.label}
                  selected={
                    draft.minPrice === range.min && draft.maxPrice === range.max
                  }
                  onPress={() => togglePriceRange(range)}
                />
              ))}
            </FilterSection>

            {filterableAttributes.map((attr) => (
              <FilterSection
                key={attr.id}
                title={attr.unit ? `${attr.name} (${attr.unit})` : attr.name}
              >
                {(attr.options || []).map((option) => (
                  <OptionRow
                    key={option}
                    label={option}
                    selected={draft.attributes?.[attr.name] === option}
                    onPress={() => toggleAttribute(attr.name, option)}
                  />
                ))}
              </FilterSection>
            ))}

            <FilterSection title='Rating'>
              {RATING_OPTIONS.map((rating) => (
                <OptionRow
                  key={rating}
                  label='& Up'
                  selected={draft.minRating === rating}
                  onPress={() => toggleRating(rating)}
                  left={<StarsRow count={rating} />}
                />
              ))}
            </FilterSection>

            <View style={styles.stockRow}>
              <Text style={styles.stockLabel}>In Stock Only</Text>
              <Switch
                value={!!draft.inStock}
                onValueChange={toggleInStock}
                trackColor={{
                  false: AppColors.gray200,
                  true: AppColors.primaryLight,
                }}
                thumbColor={draft.inStock ? AppColors.primary : AppColors.gray50}
                ios_backgroundColor={AppColors.gray200}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleClearAll} hitSlop={8}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              activeOpacity={0.85}
              onPress={handleApply}
            >
              {previewLoading ? (
                <ActivityIndicator size='small' color={AppColors.white} />
              ) : (
                <Text style={styles.applyButtonText}>
                  {previewCount !== null
                    ? `Show ${previewCount} results`
                    : 'Apply filters'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 32, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius['2xl'],
    borderTopRightRadius: AppBorderRadius['2xl'],
    maxHeight: '85%',
    ...AppShadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.gray300,
    alignSelf: 'center',
    marginTop: AppSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.slate900,
    letterSpacing: -0.3,
  },
  body: {
    flexGrow: 1,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: AppSpacing.base,
    paddingBottom: AppSpacing.xl,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppSpacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.slate900,
  },
  sectionBody: {
    paddingBottom: AppSpacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    marginBottom: 2,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
  },
  optionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    flex: 1,
    marginRight: AppSpacing.sm,
  },
  optionText: {
    fontSize: 14,
    color: AppColors.gray700,
    flexShrink: 1,
  },
  optionTextSelected: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  emptyHint: {
    fontSize: 13,
    color: AppColors.gray400,
    paddingVertical: AppSpacing.sm,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppSpacing.base,
  },
  stockLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.slate900,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    backgroundColor: AppColors.white,
    gap: AppSpacing.base,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.gray600,
    textDecorationLine: 'underline',
  },
  applyButton: {
    flex: 1,
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.md,
    borderRadius: AppBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...AppShadows.sm,
  },
  applyButtonText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
})

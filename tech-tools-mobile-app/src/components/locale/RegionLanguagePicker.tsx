// ============================================
// Region & Language Picker
// ============================================
// Two independent choices in one sheet, deliberately never coupled --
// the founder's own example: physically in Italy, app language set to
// English. Region drives displayed currency (via preferencesStore's
// setCountry); language drives i18next immediately. Modeled on
// checkout.tsx's existing country-picker Modal (same search+FlatList
// pattern, same style values) so this reads as the same app, not a
// bolted-on component.

import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { countriesSortedByName, type Country } from '@/data/countries'
import { usePreferencesStore, useAuthStore } from '@/stores'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@/i18n/config'
import { getDefaultLanguageForCountry } from '@/i18n/countryDefaults'
import { AppColors, AppSpacing, AppBorderRadius, AppShadows } from '@/constants/appTheme'

interface RegionLanguagePickerProps {
  visible: boolean
  onClose: () => void
}

type Tab = 'region' | 'language'

export default function RegionLanguagePicker({ visible, onClose }: RegionLanguagePickerProps) {
  const { t } = useTranslation('common')
  const [tab, setTab] = useState<Tab>('region')
  const [search, setSearch] = useState('')

  const country = usePreferencesStore((s) => s.country)
  const language = usePreferencesStore((s) => s.language)
  const setCountry = usePreferencesStore((s) => s.setCountry)
  const setLanguage = usePreferencesStore((s) => s.setLanguage)
  const persistToServerIfSignedIn = usePreferencesStore((s) => s.persistToServerIfSignedIn)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return countriesSortedByName
    const q = search.trim().toLowerCase()
    return countriesSortedByName.filter((c) => c.name.toLowerCase().includes(q))
  }, [search])

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType='slide' transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('locale.regionAndLanguage')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name='close' size={24} color={AppColors.gray700} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, tab === 'region' && styles.tabActive]}
              onPress={() => setTab('region')}
            >
              <Text style={[styles.tabText, tab === 'region' && styles.tabTextActive]}>
                {t('locale.region')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'language' && styles.tabActive]}
              onPress={() => setTab('language')}
            >
              <Text style={[styles.tabText, tab === 'language' && styles.tabTextActive]}>
                {t('locale.language')}
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'region' ? (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name='search' size={18} color={AppColors.gray400} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('locale.searchCountry') as string}
                  placeholderTextColor={AppColors.gray400}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name='close-circle' size={18} color={AppColors.gray400} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                style={styles.list}
                renderItem={({ item }: { item: Country }) => (
                  <TouchableOpacity
                    style={[styles.row, country === item.code && styles.rowSelected]}
                    onPress={() => {
                      setCountry(item.code)
                      persistToServerIfSignedIn(isAuthenticated)
                    }}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={styles.rowLabel}>{item.name}</Text>
                    {country === item.code && (
                      <Ionicons name='checkmark' size={20} color={AppColors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              />
            </>
          ) : (
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item}
              style={styles.list}
              renderItem={({ item }: { item: SupportedLanguage }) => {
                const isDetectedDefault = country ? getDefaultLanguageForCountry(country) === item : false
                return (
                  <TouchableOpacity
                    style={[styles.row, language === item && styles.rowSelected]}
                    onPress={() => {
                      setLanguage(item)
                      persistToServerIfSignedIn(isAuthenticated)
                    }}
                  >
                    <Text style={styles.rowLabel}>{LANGUAGE_LABELS[item]}</Text>
                    {isDetectedDefault && language !== item && (
                      <Text style={styles.detectedHint}>{t('locale.detected')}</Text>
                    )}
                    {language === item && (
                      <Ionicons name='checkmark' size={20} color={AppColors.primary} />
                    )}
                  </TouchableOpacity>
                )
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}

          <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
            <Text style={styles.doneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 32, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius['2xl'],
    borderTopRightRadius: AppBorderRadius['2xl'],
    maxHeight: '80%',
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
    paddingBottom: AppSpacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.slate900,
    letterSpacing: -0.3,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: AppSpacing.base,
    backgroundColor: AppColors.gray100,
    borderRadius: AppBorderRadius.md,
    padding: 3,
    marginBottom: AppSpacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: AppColors.white,
    ...AppShadows.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray500,
  },
  tabTextActive: {
    color: AppColors.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.gray50,
    marginHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.sm,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    gap: AppSpacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: AppColors.gray700,
    paddingVertical: 2,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: AppSpacing.base,
    paddingBottom: AppSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    gap: AppSpacing.sm,
  },
  rowSelected: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  rowFlag: {
    fontSize: 22,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: AppColors.gray700,
  },
  detectedHint: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.gray400,
  },
  doneButton: {
    margin: AppSpacing.base,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    color: AppColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
})

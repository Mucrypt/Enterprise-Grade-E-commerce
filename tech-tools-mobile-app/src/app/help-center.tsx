import React, { useEffect } from 'react'
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type Href, useRouter } from 'expo-router'

import {
  AppBorderRadius,
  AppColors,
  AppShadows,
  AppSpacing,
} from '@/constants/appTheme'
import { useAuthStore } from '@/stores'

const faqs = [
  {
    question: 'How do I track my order?',
    answer:
      'Go to Track Order from your profile and use your order number to view the latest delivery status.',
  },
  {
    question: 'How can I request a return?',
    answer:
      'Open Returns in your profile, choose your order, and submit the return reason for support review.',
  },
  {
    question: 'Can I update payment methods?',
    answer:
      'Yes. Open Payment Methods in your profile to set a default card or remove a saved card.',
  },
  {
    question: 'How do I contact support faster?',
    answer:
      'Use Smart Support from your profile to prefill account-aware requests and speed up response time.',
  },
]

export default function HelpCenterScreen() {
  const router = useRouter()
  const {
    hasHydrated,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuthStore()

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !authLoading) {
      router.replace('/(auth)/login')
    }
  }, [authLoading, hasHydrated, isAuthenticated, router])

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch {
      // No-op to avoid breaking UI from external handler failures
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name='arrow-back' size={20} color={AppColors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSubtitle}>
            Find quick answers or jump directly to support tools.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => router.push('/orders' as Href)}
        >
          <View style={styles.linkIconWrap}>
            <Ionicons name='car-outline' size={20} color={AppColors.info} />
          </View>
          <View style={styles.linkMeta}>
            <Text style={styles.linkTitle}>Track Order</Text>
            <Text style={styles.linkSubtitle}>Check delivery progress</Text>
          </View>
          <Ionicons
            name='chevron-forward'
            size={18}
            color={AppColors.gray400}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => router.push('/returns' as Href)}
        >
          <View style={styles.linkIconWrap}>
            <Ionicons
              name='return-down-back-outline'
              size={20}
              color={AppColors.warning}
            />
          </View>
          <View style={styles.linkMeta}>
            <Text style={styles.linkTitle}>Returns</Text>
            <Text style={styles.linkSubtitle}>
              Start and monitor return requests
            </Text>
          </View>
          <Ionicons
            name='chevron-forward'
            size={18}
            color={AppColors.gray400}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => router.push('/contact-us' as Href)}
        >
          <View style={styles.linkIconWrap}>
            <Ionicons
              name='chatbubble-outline'
              size={20}
              color={AppColors.primary}
            />
          </View>
          <View style={styles.linkMeta}>
            <Text style={styles.linkTitle}>Contact Us</Text>
            <Text style={styles.linkSubtitle}>
              Send support request securely
            </Text>
          </View>
          <Ionicons
            name='chevron-forward'
            size={18}
            color={AppColors.gray400}
          />
        </TouchableOpacity>

        <View style={styles.faqCard}>
          <Text style={styles.faqTitle}>Frequently asked questions</Text>
          {faqs.map((item) => (
            <View key={item.question} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.webSupportButton}
          onPress={() => openExternal('https://techtoolstore.com/contact')}
        >
          <Ionicons name='open-outline' size={16} color={AppColors.primary} />
          <Text style={styles.webSupportText}>Open web support center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
  },
  iconButtonPlaceholder: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  content: {
    padding: AppSpacing.base,
    gap: AppSpacing.md,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  heroSubtitle: {
    marginTop: AppSpacing.xs,
    color: AppColors.gray600,
    fontSize: 13,
    lineHeight: 20,
  },
  linkCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkMeta: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  linkSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: AppColors.gray500,
  },
  faqCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.base,
    ...AppShadows.sm,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
    marginBottom: AppSpacing.sm,
  },
  faqItem: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    paddingTop: AppSpacing.sm,
    marginTop: AppSpacing.sm,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.gray800,
  },
  faqAnswer: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.gray600,
  },
  webSupportButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: AppSpacing.sm,
  },
  webSupportText: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
})

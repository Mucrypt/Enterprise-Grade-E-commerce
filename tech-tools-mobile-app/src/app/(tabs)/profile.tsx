// ============================================
// TechTools Mobile App - Profile Tab Screen
// ============================================

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { type Href, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
  AppGradients,
} from '@/constants/appTheme'
import { ordersApiNew } from '@/api'
import { useAuthStore, useCartStore, useWishlistStore } from '@/stores'

interface MenuItemProps {
  icon: string
  title: string
  subtitle?: string
  onPress: () => void
  badge?: number
  color?: string
  showArrow?: boolean
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  color,
  showArrow = true,
}: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: `${color || AppColors.primary}15` },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={22}
          color={color || AppColors.primary}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {showArrow && (
        <Ionicons name='chevron-forward' size={20} color={AppColors.gray400} />
      )}
    </TouchableOpacity>
  )
}

function MenuSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.menuSection}>
      {title && <Text style={styles.menuSectionTitle}>{title}</Text>}
      <View style={styles.menuCard}>{children}</View>
    </View>
  )
}

export default function ProfileTabScreen() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const cartCount = useCartStore((state) => state.itemCount())
  const wishlistCount = useWishlistStore((state) => state.items.length)
  const [activeOrdersCount, setActiveOrdersCount] = useState(0)
  const [totalOrdersCount, setTotalOrdersCount] = useState(0)

  useEffect(() => {
    const loadOrdersSummary = async () => {
      if (!isAuthenticated) {
        setActiveOrdersCount(0)
        setTotalOrdersCount(0)
        return
      }

      try {
        const response = await ordersApiNew.getAll(1, 50)
        const orders = response.orders || []
        const activeStatuses = new Set([
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'ready_to_ship',
        ])

        const active = orders.filter((order) =>
          activeStatuses.has(order.order_status),
        ).length

        setActiveOrdersCount(active)
        setTotalOrdersCount(response.pagination?.total || orders.length)
      } catch (error) {
        setActiveOrdersCount(0)
        setTotalOrdersCount(0)
      }
    }

    loadOrdersSummary()
  }, [isAuthenticated])

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout()
        },
      },
    ])
  }

  const openSmartSupport = () => {
    router.push('/support' as Href)
  }

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert('Unavailable', 'Could not open this link right now.')
    }
  }

  // Guest View
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
        </View>

        <View style={styles.guestContainer}>
          <LinearGradient
            colors={AppGradients.primary as [string, string, ...string[]]}
            style={styles.guestIcon}
          >
            <Ionicons name='person' size={48} color={AppColors.white} />
          </LinearGradient>
          <Text style={styles.guestTitle}>Welcome to TechTools</Text>
          <Text style={styles.guestText}>
            Sign in to access your orders, wishlist, and personalized
            recommendations.
          </Text>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              style={styles.signInGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createAccountButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.createAccountText}>
              Don't have an account?{' '}
              <Text style={styles.createAccountLink}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Guest Quick Links */}
        <MenuSection>
          <MenuItem
            icon='help-circle-outline'
            title='Help & Support'
            onPress={() => router.push('/help-center' as Href)}
            color={AppColors.info}
          />
          <MenuItem
            icon='document-text-outline'
            title='Terms & Conditions'
            onPress={() => openExternal('https://techtoolstore.com/terms')}
          />
          <MenuItem
            icon='shield-checkmark-outline'
            title='Privacy Policy'
            onPress={() => openExternal('https://techtoolstore.com/privacy')}
          />
        </MenuSection>
      </SafeAreaView>
    )
  }

  // Authenticated View
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={AppGradients.primary as [string, string, ...string[]]}
          style={styles.profileHeader}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.first_name?.charAt(0) ||
                  user?.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name='camera' size={14} color={AppColors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>
            {user?.first_name} {user?.last_name}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.stat}>
              <Text style={styles.statValue}>{totalOrdersCount}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push('/(tabs)/wishlist')}
            >
              <Text style={styles.statValue}>{wishlistCount}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push('/(tabs)/cart')}
            >
              <Text style={styles.statValue}>{cartCount}</Text>
              <Text style={styles.statLabel}>Cart</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.quickAccessSection}>
          <TouchableOpacity
            style={styles.quickAccessPrimaryCard}
            onPress={() => router.push('/(tabs)/books' as Href)}
            activeOpacity={0.9}
          >
            <View style={styles.quickAccessIconWrapPrimary}>
              <Ionicons name='book-outline' size={22} color={AppColors.white} />
            </View>
            <View style={styles.quickAccessTextWrap}>
              <Text style={styles.quickAccessPrimaryTitle}>Books Library</Text>
              <Text style={styles.quickAccessPrimarySubtitle}>
                Discover digital books and creator releases.
              </Text>
            </View>
            <Ionicons
              name='chevron-forward'
              size={18}
              color='rgba(255,255,255,0.9)'
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAccessSecondaryCard}
            onPress={() => router.push('/profile/seller' as Href)}
            activeOpacity={0.9}
          >
            <View style={styles.quickAccessIconWrapSecondary}>
              <Ionicons
                name='storefront-outline'
                size={22}
                color={AppColors.primary}
              />
            </View>
            <View style={styles.quickAccessTextWrap}>
              <Text style={styles.quickAccessSecondaryTitle}>Seller Hub</Text>
              <Text style={styles.quickAccessSecondarySubtitle}>
                Manage business mode and trust tiers.
              </Text>
            </View>
            <Ionicons
              name='chevron-forward'
              size={18}
              color={AppColors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        <MenuSection title='My Orders'>
          <MenuItem
            icon='receipt-outline'
            title='All Orders'
            subtitle='View your order history'
            onPress={() => router.push('/orders' as Href)}
            badge={activeOrdersCount}
          />
          <MenuItem
            icon='car-outline'
            title='Track Order'
            subtitle='Check delivery status'
            onPress={() => router.push('/track-order' as Href)}
          />
          <MenuItem
            icon='return-down-back-outline'
            title='Returns'
            subtitle='Manage returns & refunds'
            onPress={() => router.push('/returns' as Href)}
          />
        </MenuSection>

        <MenuSection title='My Account'>
          <MenuItem
            icon='book-outline'
            title='Books Library'
            subtitle='Browse and buy digital books'
            onPress={() => router.push('/books' as Href)}
          />
          <MenuItem
            icon='storefront-outline'
            title='Seller Hub'
            subtitle='Manage business mode, seller profile, and verification'
            onPress={() => router.push('/profile/seller' as Href)}
          />
          <MenuItem
            icon='person-outline'
            title='Edit Profile'
            onPress={() => router.push('/profile/edit' as Href)}
          />
          <MenuItem
            icon='location-outline'
            title='Addresses'
            subtitle='Manage delivery addresses'
            onPress={() => router.push('/profile/addresses' as Href)}
          />
          <MenuItem
            icon='card-outline'
            title='Payment Methods'
            onPress={() => router.push('/profile/payment-methods' as Href)}
          />
          <MenuItem
            icon='notifications-outline'
            title='Notifications'
            subtitle='Manage preferences'
            onPress={() => router.push('/profile/notifications' as Href)}
          />
        </MenuSection>

        <MenuSection title='Support'>
          <MenuItem
            icon='sparkles-outline'
            title='Smart Support'
            subtitle='Open personalized live help from your profile'
            onPress={openSmartSupport}
            color={AppColors.primary}
          />
          <MenuItem
            icon='help-circle-outline'
            title='Help Center'
            onPress={() => router.push('/help-center' as Href)}
            color={AppColors.info}
          />
          <MenuItem
            icon='chatbubble-outline'
            title='Contact Us'
            onPress={() => router.push('/contact-us' as Href)}
            color={AppColors.info}
          />
          <MenuItem
            icon='star-outline'
            title='Rate the App'
            onPress={() => router.push('/rate-app' as Href)}
            color={AppColors.warning}
          />
        </MenuSection>

        <MenuSection>
          <MenuItem
            icon='settings-outline'
            title='Settings'
            onPress={() => router.push('/profile/settings' as Href)}
          />
          <MenuItem
            icon='log-out-outline'
            title='Logout'
            onPress={handleLogout}
            color={AppColors.error}
            showArrow={false}
          />
        </MenuSection>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>TechTools v1.0.0</Text>
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
  header: {
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.gray800,
  },
  guestContainer: {
    alignItems: 'center',
    padding: AppSpacing.xl,
    paddingTop: AppSpacing['3xl'],
  },
  guestIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.gray800,
    marginBottom: AppSpacing.sm,
  },
  guestText: {
    fontSize: 14,
    color: AppColors.gray500,
    textAlign: 'center',
    marginBottom: AppSpacing.xl,
    paddingHorizontal: AppSpacing.lg,
    lineHeight: 22,
  },
  signInButton: {
    width: '100%',
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: AppSpacing.md,
  },
  signInGradient: {
    paddingVertical: AppSpacing.base,
    alignItems: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
  createAccountButton: {
    paddingVertical: AppSpacing.sm,
  },
  createAccountText: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  createAccountLink: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  profileHeader: {
    paddingTop: AppSpacing.xl,
    paddingBottom: AppSpacing.lg,
    paddingHorizontal: AppSpacing.base,
    alignItems: 'center',
  },
  quickAccessSection: {
    paddingHorizontal: AppSpacing.base,
    marginTop: AppSpacing.lg,
    gap: AppSpacing.md,
  },
  quickAccessPrimaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
    ...AppShadows.sm,
  },
  quickAccessSecondaryCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
    ...AppShadows.sm,
  },
  quickAccessIconWrapPrimary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessIconWrapSecondary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessTextWrap: {
    flex: 1,
  },
  quickAccessPrimaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.white,
  },
  quickAccessPrimarySubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.85)',
  },
  quickAccessSecondaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.gray900,
  },
  quickAccessSecondarySubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.gray500,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: AppSpacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: AppColors.white,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: AppColors.white,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppColors.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.white,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: AppSpacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: AppBorderRadius.lg,
    paddingVertical: AppSpacing.md,
    paddingHorizontal: AppSpacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: AppSpacing.md,
  },
  menuSection: {
    marginTop: AppSpacing.lg,
    paddingHorizontal: AppSpacing.base,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: AppSpacing.sm,
    marginLeft: AppSpacing.xs,
  },
  menuCard: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    ...AppShadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: AppSpacing.base,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppSpacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.gray800,
  },
  menuSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 2,
  },
  badge: {
    backgroundColor: AppColors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppSpacing.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.white,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: AppSpacing.xl,
    marginBottom: 100,
  },
  versionText: {
    fontSize: 12,
    color: AppColors.gray400,
  },
})

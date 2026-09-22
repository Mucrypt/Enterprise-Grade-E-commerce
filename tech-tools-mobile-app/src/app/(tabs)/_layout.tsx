// ============================================
// TechTools Mobile App - Tabs Layout
// ============================================
// Fully custom tab bar (via the `tabBar` render prop, not
// tabBarIcon/tabBarStyle knobs on top of React Navigation's stock
// bar) -- the previous style-only attempts kept losing fights with
// React Navigation's own default item layout (an active highlight that
// rendered as a full-cell block instead of a small chip, labels
// word-wrapping mid-word). A hand-built bar removes that whole class of
// bug: every size here is an explicit, fixed number, never inferred
// from a column's ambiguous flex width.
//
// Design: a dark industrial-glass bar (matches Home's ToolsHero/
// WorkshopMachinerySection gradient) so it reads as TechTools' own
// signature. Each side tab is icon-in-a-circle (fixed 40x40, so the
// active highlight is always a perfect circle regardless of label
// width) with a single-line label underneath. Discover, the most
// important tab, is treated as the star: a large glowing button raised
// well above the bar, icon-only (no label to crowd it) -- the same
// "oversized, unmissable center action" language TikTok/Snapchat use
// for their own primary action button.

import React from 'react'
import { Tabs } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { AppColors, AppGradients } from '@/constants/appTheme'
import { useCartStore } from '@/stores'

const BAR_BG = AppGradients.industrial // ['#0F1420', '#1B2436']
const BAR_DARK = '#0F1420'

// Routes kept navigable (router.push still works) but never given a
// button in this bar -- books lives under Home/Explore, wishlist under
// the header's heart icon.
const HIDDEN_ROUTES = new Set(['books', 'wishlist'])

const TAB_META: Record<string, { label: string; icon: string; iconOutline: string }> = {
  index: { label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  explore: { label: 'Explore', icon: 'search', iconOutline: 'search-outline' },
  cart: { label: 'Cart', icon: 'cart', iconOutline: 'cart-outline' },
  profile: { label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
}

function SideTabButton({
  focused,
  label,
  icon,
  badge,
  onPress,
}: {
  focused: boolean
  label: string
  icon: string
  badge?: number
  onPress: () => void
}) {
  const progress = useSharedValue(focused ? 1 : 0)

  React.useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 200 })
  }, [focused, progress])

  const circleStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }))

  return (
    <Pressable
      onPress={onPress}
      style={styles.sideTab}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole='button'
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <View style={styles.sideTabIconSlot}>
        {/* Fixed 40x40 circle, always -- never sized by the label's
            width, which is what turned this into a full-cell block
            before. */}
        <Animated.View style={[styles.sideTabCircle, circleStyle]} />
        <Ionicons
          name={icon as any}
          size={22}
          color={focused ? AppColors.white : AppColors.slate400}
        />
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.sideTabLabel, focused && styles.sideTabLabelActive]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function CenterTabButton({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const pulse = useSharedValue(0)
  const press = useSharedValue(0)

  React.useEffect(() => {
    if (focused) {
      pulse.value = withTiming(0, { duration: 200 })
      return
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 1300, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [focused, pulse])

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 - pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }))

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.08 }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 })
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 150 })
      }}
      style={styles.centerTab}
      hitSlop={{ top: 12, bottom: 4, left: 12, right: 12 }}
      accessibilityRole='button'
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel='Discover'
    >
      <Animated.View style={[styles.centerGlowOuter, glowStyle]} />
      <Animated.View style={[styles.centerButtonShadowWrap, pressStyle]}>
        <LinearGradient
          colors={focused ? ['#FF8F6B', AppColors.primary] : AppGradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.centerButton}
        >
          <Ionicons name='sparkles' size={26} color={AppColors.white} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  )
}

function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const cartCount = useCartStore((s) => s.itemCount())
  const bottomPadding = Math.max(10, insets.bottom)

  const visibleRoutes = state.routes.filter((route) => !HIDDEN_ROUTES.has(route.name))

  return (
    <View
      style={[
        styles.tabBar,
        { height: 64 + bottomPadding, paddingBottom: bottomPadding },
      ]}
    >
      <View style={styles.backgroundClip}>
        <LinearGradient
          colors={BAR_BG}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topHairline} />
      </View>

      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key)
          const isFocused = state.index === routeIndex

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          if (route.name === 'discover') {
            return <CenterTabButton key={route.key} focused={isFocused} onPress={onPress} />
          }

          const meta = TAB_META[route.name]
          if (!meta) return null

          return (
            <SideTabButton
              key={route.key}
              focused={isFocused}
              label={meta.label}
              icon={isFocused ? meta.icon : meta.iconOutline}
              badge={route.name === 'cart' ? cartCount : undefined}
              onPress={onPress}
            />
          )
        })}
      </View>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name='index' options={{ title: 'Home' }} />
      <Tabs.Screen name='explore' options={{ title: 'Explore' }} />
      <Tabs.Screen name='books' options={{ href: null }} />
      {/* Trending's real content (collections/stores) has been folded
          into Home, and the trending.tsx screen itself removed --
          Discover now occupies this raised center slot instead. */}
      <Tabs.Screen name='discover' options={{ title: 'Discover' }} />
      <Tabs.Screen name='cart' options={{ title: 'Cart' }} />
      <Tabs.Screen name='wishlist' options={{ href: null }} />
      <Tabs.Screen name='profile' options={{ title: 'Profile' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    // Deliberately NOT overflow:'hidden' here -- this is the container
    // the raised center button pokes above on purpose. Only
    // backgroundClip below is clipped, to round just the gradient.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  backgroundClip: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // ---- Side tabs (Home / Explore / Cart / Profile) ----
  sideTab: {
    flex: 1,
    alignItems: 'center',
  },
  sideTabIconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTabCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    ...Platform.select({
      ios: {
        shadowColor: AppColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sideTabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.slate400,
    marginTop: 2,
  },
  sideTabLabelActive: {
    color: AppColors.white,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: AppColors.error,
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: BAR_DARK,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.white,
  },
  // ---- Center tab (Discover) -- the star of the bar ----
  centerTab: {
    width: 84,
    alignItems: 'center',
    marginTop: -30,
  },
  centerGlowOuter: {
    position: 'absolute',
    top: 4,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AppColors.primary,
  },
  centerButtonShadowWrap: {
    ...Platform.select({
      ios: {
        shadowColor: AppColors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  centerButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: BAR_DARK,
  },
})

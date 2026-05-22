// ============================================
// TechTools Mobile App - Tabs Layout
// ============================================

import React from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { AppColors, AppGradients } from '@/constants/appTheme'
import { useCartStore } from '@/stores'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface TabBarIconProps {
  focused: boolean
  color: string
  name: string
  badge?: number
}

function TabBarIcon({ focused, color, name, badge }: TabBarIconProps) {
  return (
    <View style={styles.iconWrapper}>
      <View
        style={[styles.iconContainer, focused && styles.iconContainerActive]}
      >
        <Ionicons name={name as any} size={22} color={color} />
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  )
}

// Special center tab icon with beautiful floating design
function CenterTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.centerTabWrapper}>
      <View style={styles.centerTabOuter}>
        <LinearGradient
          colors={
            focused ? [AppColors.primary, '#FF8F6B'] : ['#FFE5DB', '#FFF0EB']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.centerTabGradient}
        >
          <Ionicons
            name={focused ? 'stats-chart' : 'stats-chart-outline'}
            size={20}
            color={focused ? AppColors.white : AppColors.primary}
          />
        </LinearGradient>
      </View>
    </View>
  )
}

export default function TabsLayout() {
  const cartCount = useCartStore((state) => state.itemCount())
  const insets = useSafeAreaInsets()

  // Calculate bottom padding: minimum 16px, or safe area + 8px
  const bottomPadding = Math.max(16, insets.bottom + 8)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.gray400,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 70 + bottomPadding,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              name={focused ? 'home' : 'home-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name='explore'
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              name={focused ? 'search' : 'search-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name='books'
        options={{
          title: 'Books',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              name={focused ? 'book' : 'book-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name='trending'
        options={{
          title: 'Trending',
          tabBarLabel: ({ focused }) => (
            <Text
              style={[
                styles.centerTabLabel,
                focused && styles.centerTabLabelActive,
              ]}
            >
              Trending
            </Text>
          ),
          tabBarIcon: ({ focused }) => <CenterTabIcon focused={focused} />,
          tabBarItemStyle: styles.centerTabItem,
        }}
      />
      <Tabs.Screen
        name='cart'
        options={{
          title: 'Cart',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              name={focused ? 'cart' : 'cart-outline'}
              badge={cartCount}
            />
          ),
        }}
      />
      {/* Hide wishlist from tabs - accessible from header */}
      <Tabs.Screen
        name='wishlist'
        options={{
          href: null, // Hides from tab bar but keeps route accessible
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              name={focused ? 'person' : 'person-outline'}
            />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: AppColors.white,
    borderTopWidth: 0,
    paddingTop: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  tabBarItem: {
    paddingTop: 4,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  iconContainerActive: {
    backgroundColor: `${AppColors.primary}15`,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: AppColors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: AppColors.white,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.white,
  },
  // Center Tab (Trending) - Beautiful floating design
  centerTabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: -12,
  },
  centerTabOuter: {
    ...Platform.select({
      ios: {
        shadowColor: AppColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  centerTabGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppColors.white,
  },
  centerTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.gray400,
    marginTop: 6,
  },
  centerTabLabelActive: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  centerTabItem: {
    paddingTop: 4,
  },
})

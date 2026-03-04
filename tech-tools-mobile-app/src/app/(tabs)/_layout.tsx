// ============================================
// TechTools Mobile App - Tabs Layout
// ============================================

import React from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppColors, AppShadows } from '@/constants/appTheme'
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
      <Tabs.Screen
        name='wishlist'
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              focused={focused}
              color={color}
              name={focused ? 'heart' : 'heart-outline'}
            />
          ),
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
})

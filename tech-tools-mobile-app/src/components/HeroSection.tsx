// ============================================
// TechTools Mobile App - Hero Section Component
// ============================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppColors, AppBorderRadius, AppSpacing, AppGradients } from '@/constants/appTheme';
import SearchBar from './SearchBar';

const { width } = Dimensions.get('window');

export default function HeroSection() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={AppGradients.hero as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.brand}>TechTools</Text>
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push('/cart')}
        >
          <Ionicons name="cart-outline" size={24} color={AppColors.white} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar placeholder="Search for products, brands..." />
      </View>

      {/* Promo Banner */}
      <View style={styles.promoBanner}>
        <View style={styles.promoContent}>
          <View style={styles.promoTag}>
            <Text style={styles.promoTagText}>NEW ARRIVALS</Text>
          </View>
          <Text style={styles.promoTitle}>Tech Essentials</Text>
          <Text style={styles.promoSubtitle}>Up to 40% off on latest gadgets</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push('/products')}
          >
            <Text style={styles.shopButtonText}>Shop Now</Text>
            <Ionicons name="arrow-forward" size={16} color={AppColors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.promoDecoration}>
          <Ionicons name="hardware-chip" size={80} color="rgba(255,255,255,0.2)" />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingBottom: AppSpacing['2xl'],
    paddingHorizontal: AppSpacing.base,
    borderBottomLeftRadius: AppBorderRadius['2xl'],
    borderBottomRightRadius: AppBorderRadius['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  welcome: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.white,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginBottom: AppSpacing.lg,
  },
  promoBanner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.lg,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  promoContent: {
    flex: 1,
  },
  promoTag: {
    backgroundColor: AppColors.white,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: AppSpacing.sm,
  },
  promoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
  },
  promoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.white,
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: AppSpacing.md,
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.white,
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    alignSelf: 'flex-start',
    gap: AppSpacing.xs,
  },
  shopButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
  },
  promoDecoration: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    opacity: 0.5,
  },
});

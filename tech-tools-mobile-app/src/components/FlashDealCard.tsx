// ============================================
// TechTools Mobile App - Flash Deal Card Component
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Product } from '@/types';
import { formatPrice, calculateDiscount, getProductImage, formatCountdown } from '@/utils';
import { AppColors, AppBorderRadius, AppShadows, AppSpacing, AppGradients } from '@/constants/appTheme';
import { useCartStore } from '@/stores';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42;

interface FlashDealCardProps {
  product: Product;
  badge?: 'HOT' | 'FLASH' | 'DEAL';
  endTime?: Date;
}

export default function FlashDealCard({ product, badge = 'FLASH', endTime }: FlashDealCardProps) {
  const router = useRouter();
  const addToCart = useCartStore((state) => state.addItem);
  const [countdown, setCountdown] = useState(formatCountdown(endTime || new Date(Date.now() + 3600000 * 6)));

  useEffect(() => {
    if (!endTime) return;
    
    const timer = setInterval(() => {
      setCountdown(formatCountdown(endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  const basePrice = Number(product.base_price);
  const salePrice = product.sale_price ? Number(product.sale_price) : basePrice * 0.7;
  const discountPercent = calculateDiscount(basePrice, salePrice);

  const handlePress = () => {
    router.push(`/product/${product.slug}`);
  };

  const handleAddToCart = () => {
    addToCart(product);
  };

  const getBadgeStyle = () => {
    switch (badge) {
      case 'HOT': return { bg: AppColors.badgeHot, icon: 'flame' };
      case 'DEAL': return { bg: AppColors.badgeDeal, icon: 'pricetag' };
      default: return { bg: AppColors.badgeFlash, icon: 'flash' };
    }
  };

  const badgeStyle = getBadgeStyle();

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
      <LinearGradient
        colors={['#FFF5F0', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Badge */}
        <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
          <Ionicons name={badgeStyle.icon as any} size={10} color={AppColors.white} />
          <Text style={styles.badgeText}>{badge}</Text>
        </View>

        {/* Discount badge */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{discountPercent}%</Text>
        </View>

        {/* Product image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getProductImage(product) }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Product info */}
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.salePrice}>{formatPrice(salePrice)}</Text>
            <Text style={styles.originalPrice}>{formatPrice(basePrice)}</Text>
          </View>

          {/* Countdown timer */}
          <View style={styles.timerContainer}>
            <Ionicons name="time-outline" size={12} color={AppColors.primary} />
            <Text style={styles.timerText}>
              {String(countdown.hours).padStart(2, '0')}:
              {String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </Text>
          </View>

          {/* Add to cart button */}
          <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
            <Ionicons name="cart-outline" size={14} color={AppColors.white} />
            <Text style={styles.addButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    borderRadius: AppBorderRadius.xl,
    overflow: 'hidden',
    marginRight: AppSpacing.md,
    ...AppShadows.lg,
  },
  gradient: {
    flex: 1,
    padding: AppSpacing.md,
  },
  badge: {
    position: 'absolute',
    top: AppSpacing.sm,
    left: AppSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.md,
    gap: 4,
    zIndex: 10,
  },
  badgeText: {
    color: AppColors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: AppSpacing.sm,
    right: AppSpacing.sm,
    backgroundColor: AppColors.primary,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 4,
    borderRadius: AppBorderRadius.md,
    zIndex: 10,
  },
  discountText: {
    color: AppColors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
    marginTop: AppSpacing.xl,
    marginBottom: AppSpacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
    marginBottom: AppSpacing.xs,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.xs,
  },
  salePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: AppSpacing.sm,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    gap: 6,
  },
  addButtonText: {
    color: AppColors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

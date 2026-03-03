// ============================================
// TechTools Mobile App - Wishlist Tab Screen
// ============================================

import React from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Button } from '@/components'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
  AppGradients,
} from '@/constants/appTheme'
import { useWishlistStore, useCartStore } from '@/stores'
import { formatPrice, calculateDiscount, getProductImage } from '@/utils'
import { Product } from '@/types'

const { width } = Dimensions.get('window')

function WishlistItem({ product }: { product: Product }) {
  const router = useRouter()
  const { removeItem } = useWishlistStore()
  const addToCart = useCartStore((state) => state.addItem)

  const basePrice = Number(product.base_price)
  const salePrice = product.sale_price ? Number(product.sale_price) : null
  const hasDiscount = salePrice !== null && salePrice < basePrice
  const discountPercent = hasDiscount
    ? calculateDiscount(basePrice, salePrice!)
    : 0

  const handleAddToCart = () => {
    addToCart(product)
    removeItem(product.id)
  }

  return (
    <TouchableOpacity
      style={styles.wishlistItem}
      onPress={() => router.push(`/product/${product.slug}`)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: getProductImage(product) }}
          style={styles.itemImage}
          resizeMode='cover'
        />
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercent}%</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.removeIconButton}
          onPress={() => removeItem(product.id)}
        >
          <Ionicons name='close' size={16} color={AppColors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemCategory}>{product.category_name}</Text>
        <Text style={styles.itemName} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {formatPrice(salePrice ?? basePrice)}
          </Text>
          {hasDiscount && (
            <Text style={styles.originalPrice}>{formatPrice(basePrice)}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={handleAddToCart}
        >
          <Ionicons name='cart-outline' size={16} color={AppColors.white} />
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function WishlistTabScreen() {
  const router = useRouter()
  const { items, clearWishlist } = useWishlistStore()
  const addToCart = useCartStore((state) => state.addItem)

  const handleAddAllToCart = () => {
    items.forEach((product) => addToCart(product))
    clearWishlist()
    Alert.alert('Success', 'All items have been added to your cart!')
  }

  const handleClearWishlist = () => {
    Alert.alert(
      'Clear Wishlist',
      'Are you sure you want to remove all items from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearWishlist },
      ],
    )
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name='heart-outline'
              size={64}
              color={AppColors.gray300}
            />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyText}>
            Save items you love by tapping the heart icon on any product.
          </Text>
          <Button
            title='Start Exploring'
            onPress={() => router.push('/(tabs)/explore')}
            icon='compass-outline'
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <TouchableOpacity onPress={handleClearWishlist}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{items.length} items saved</Text>
        <TouchableOpacity
          onPress={handleAddAllToCart}
          style={styles.addAllButton}
        >
          <Ionicons name='cart-outline' size={16} color={AppColors.primary} />
          <Text style={styles.addAllText}>Add All to Cart</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <WishlistItem product={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.error,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.md,
    backgroundColor: AppColors.white,
  },
  statsText: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  addAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  addAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSpacing.xl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: AppSpacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.gray800,
    marginBottom: AppSpacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.gray500,
    textAlign: 'center',
    marginBottom: AppSpacing.xl,
    paddingHorizontal: AppSpacing.lg,
  },
  listContent: {
    padding: AppSpacing.base,
    paddingBottom: AppSpacing['3xl'],
  },
  row: {
    justifyContent: 'space-between',
  },
  wishlistItem: {
    width: (width - AppSpacing.base * 2 - AppSpacing.md) / 2,
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    marginBottom: AppSpacing.md,
    overflow: 'hidden',
    ...AppShadows.sm,
  },
  imageContainer: {
    aspectRatio: 1,
    backgroundColor: AppColors.gray100,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: AppSpacing.sm,
    left: AppSpacing.sm,
    backgroundColor: AppColors.error,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 2,
    borderRadius: AppBorderRadius.sm,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.white,
  },
  removeIconButton: {
    position: 'absolute',
    top: AppSpacing.sm,
    right: AppSpacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    padding: AppSpacing.md,
  },
  itemCategory: {
    fontSize: 11,
    color: AppColors.gray500,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray800,
    lineHeight: 18,
    marginBottom: AppSpacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
    marginBottom: AppSpacing.sm,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.md,
    gap: AppSpacing.xs,
  },
  addToCartText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.white,
  },
})

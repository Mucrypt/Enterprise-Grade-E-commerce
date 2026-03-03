// ============================================
// TechTools Mobile App - Cart Tab Screen
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
import { useCartStore } from '@/stores'
import { formatPrice, getProductImage } from '@/utils'
import { CartItem as CartItemType } from '@/types'

const { width } = Dimensions.get('window')

function CartItem({ item }: { item: CartItemType }) {
  const { updateQuantity, removeItem } = useCartStore()
  const price =
    Number(item.product.sale_price) || Number(item.product.base_price)
  const totalPrice = price * item.quantity

  return (
    <View style={styles.cartItem}>
      <Image
        source={{ uri: getProductImage(item.product) }}
        style={styles.itemImage}
        resizeMode='cover'
      />
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.product.name}
        </Text>
        <Text style={styles.itemPrice}>{formatPrice(totalPrice)}</Text>

        <View style={styles.quantityRow}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
            >
              <Ionicons name='remove' size={16} color={AppColors.gray700} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
            >
              <Ionicons name='add' size={16} color={AppColors.gray700} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeItem(item.product.id)}
          >
            <Ionicons name='trash-outline' size={18} color={AppColors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default function CartTabScreen() {
  const router = useRouter()
  const { items, itemCount, subtotal, clearCart } = useCartStore()

  const count = itemCount()
  const total = subtotal()
  const shipping = total > 50 ? 0 : 5.99
  const tax = total * 0.08
  const grandTotal = total + shipping + tax

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name='cart-outline' size={64} color={AppColors.gray300} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Looks like you haven't added any items to your cart yet.
          </Text>
          <Button
            title='Start Shopping'
            onPress={() => router.push('/(tabs)/explore')}
            icon='bag-outline'
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearButton}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        renderItem={({ item }) => <CartItem item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          {/* Free Shipping Progress */}
          {total < 50 && (
            <View style={styles.freeShipping}>
              <Ionicons
                name='car-outline'
                size={16}
                color={AppColors.primary}
              />
              <Text style={styles.freeShippingText}>
                Add {formatPrice(50 - total)} more for free shipping!
              </Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({count} items)</Text>
            <Text style={styles.summaryValue}>{formatPrice(total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text
              style={[styles.summaryValue, shipping === 0 && styles.freeText]}
            >
              {shipping === 0 ? 'FREE' : formatPrice(shipping)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Tax</Text>
            <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(grandTotal)}</Text>
          </View>

          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => router.push('/checkout')}
          >
            <LinearGradient
              colors={AppGradients.primary as [string, string, ...string[]]}
              style={styles.checkoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons
                name='lock-closed-outline'
                size={20}
                color={AppColors.white}
              />
              <Text style={styles.checkoutText}>Secure Checkout</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.paymentMethods}>
            <Ionicons name='card-outline' size={24} color={AppColors.gray400} />
            <Text style={styles.paymentText}>Visa, Mastercard, PayPal</Text>
          </View>
        </View>
      </View>
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
  },
  listContent: {
    padding: AppSpacing.base,
    paddingBottom: AppSpacing.lg,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.lg,
    padding: AppSpacing.md,
    ...AppShadows.sm,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: AppBorderRadius.md,
    backgroundColor: AppColors.gray100,
  },
  itemContent: {
    flex: 1,
    marginLeft: AppSpacing.md,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray800,
    lineHeight: 20,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.primary,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.xs,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray800,
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: AppSpacing.xs,
  },
  separator: {
    height: AppSpacing.md,
  },
  summaryContainer: {
    padding: AppSpacing.base,
    backgroundColor: AppColors.white,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  summaryCard: {
    backgroundColor: AppColors.white,
  },
  freeShipping: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${AppColors.primary}10`,
    padding: AppSpacing.md,
    borderRadius: AppBorderRadius.md,
    marginBottom: AppSpacing.md,
  },
  freeShippingText: {
    marginLeft: AppSpacing.sm,
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AppSpacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray800,
  },
  freeText: {
    color: AppColors.success,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    paddingTop: AppSpacing.md,
    marginTop: AppSpacing.sm,
    marginBottom: AppSpacing.md,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray800,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.primary,
  },
  checkoutButton: {
    borderRadius: AppBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: AppSpacing.md,
  },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: AppSpacing.base,
    gap: AppSpacing.sm,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.white,
  },
  paymentMethods: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.sm,
  },
  paymentText: {
    fontSize: 12,
    color: AppColors.gray400,
  },
})

// ============================================
// TechTools Mobile App - Discover Product Bottom Sheet
// ============================================
// Opens over the feed without navigating away -- the founder's explicit
// requirement ("the product button should not immediately throw users
// away from the feed"). Built on core React Native `Modal` -- no
// bottom-sheet library is installed in this app (same convention as
// FilterSheet.tsx). Reuses DeliveryEstimate.tsx verbatim. No variant
// selector/purchase-panel component existed anywhere on mobile before
// this (confirmed: product/[slug].tsx has no variant UI at all) -- this
// is the first one, matching web's PurchasePanel.tsx behavior.

import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Product, ProductVariant } from '@/types'
import { useCartStore } from '@/stores'
import { discoverApi } from '@/api'
import { getEventTracker } from '@/services/event-tracking'
import { formatPrice, getProductImage } from '@/utils'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
} from '@/constants/appTheme'
import DeliveryEstimate from '@/components/DeliveryEstimate'

interface ProductBottomSheetProps {
  visible: boolean
  products: Product[]
  initialProductId?: string
  discoverPostId: string
  onClose: () => void
}

export default function ProductBottomSheet({
  visible,
  products,
  initialProductId,
  discoverPostId,
  onClose,
}: ProductBottomSheetProps) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || products[0]?.id,
  )
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  const product = products.find((p) => p.id === selectedProductId) || products[0]
  if (!product) return null

  const variants = product.variations || []
  const availableStock = selectedVariant ? selectedVariant.stock : product.total_stock
  const outOfStock = (availableStock ?? 0) <= 0
  const unitPrice =
    Number(product.sale_price ?? product.base_price) + Number(selectedVariant?.price_adjustment ?? 0)

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id)
    setQuantity(1)
    setSelectedVariant(null)
  }

  const handleAddToCart = () => {
    addItem(product, quantity, selectedVariant || undefined, discoverPostId)
    getEventTracker().trackAddToCart(product.id, product.name, unitPrice, quantity, undefined)
    discoverApi.trackAddToCart(discoverPostId).catch(() => {})
    onClose()
  }

  const handleViewDetails = () => {
    onClose()
    router.push(`/product/${product.slug}` as never)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdropWrap}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {products.length > 1 ? `${products.length} Products` : 'Product'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={AppColors.gray700} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {products.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {products.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleSelectProduct(p.id)}
                    style={[
                      styles.thumb,
                      p.id === selectedProductId && styles.thumbActive,
                    ]}
                  >
                    <Image source={{ uri: getProductImage(p) }} style={styles.thumbImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.productRow}>
              <Image source={{ uri: getProductImage(product) }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatPrice(unitPrice)}</Text>
                  {!!product.sale_price && (
                    <Text style={styles.originalPrice}>{formatPrice(product.base_price)}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={handleViewDetails} style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetailsText}>View full details</Text>
                  <Ionicons name="arrow-forward" size={14} color={AppColors.gray500} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.deliveryWrap}>
              <DeliveryEstimate productId={product.id} />
            </View>

            <View style={styles.stockRow}>
              {!outOfStock ? (
                <>
                  <Ionicons name="checkmark-circle" size={16} color={AppColors.success} />
                  <Text style={styles.inStockText}>In Stock</Text>
                  {(availableStock ?? 0) < 20 && (
                    <Text style={styles.lowStockText}>(Only {availableStock} left!)</Text>
                  )}
                </>
              ) : (
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              )}
            </View>

            {variants.length > 0 && (
              <View style={styles.variantsSection}>
                <Text style={styles.sectionLabel}>Options:</Text>
                <View style={styles.variantsRow}>
                  {variants.map((variant) => (
                    <TouchableOpacity
                      key={variant.id}
                      onPress={() => setSelectedVariant(variant)}
                      disabled={variant.stock <= 0}
                      style={[
                        styles.variantChip,
                        selectedVariant?.id === variant.id && styles.variantChipActive,
                        variant.stock <= 0 && styles.variantChipDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.variantChipText,
                          selectedVariant?.id === variant.id && styles.variantChipTextActive,
                        ]}
                      >
                        {variant.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.quantitySection}>
              <Text style={styles.sectionLabel}>Quantity:</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Ionicons name="remove" size={16} color={AppColors.gray700} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity((q) => Math.min(availableStock || 99, q + 1))}
                >
                  <Ionicons name="add" size={16} color={AppColors.gray700} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.addToCartButton, outOfStock && styles.addToCartButtonDisabled]}
            onPress={handleAddToCart}
            disabled={outOfStock}
          >
            <Text style={styles.addToCartText}>
              Add to Cart -- {formatPrice(unitPrice * quantity)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 32, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AppColors.white,
    borderTopLeftRadius: AppBorderRadius['2xl'],
    borderTopRightRadius: AppBorderRadius['2xl'],
    maxHeight: '85%',
    paddingBottom: AppSpacing.lg,
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
    paddingVertical: AppSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  thumbRow: {
    paddingHorizontal: AppSpacing.base,
    paddingTop: AppSpacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: AppBorderRadius.md,
    marginRight: AppSpacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbActive: {
    borderColor: AppColors.primary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  productRow: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    padding: AppSpacing.base,
  },
  productImage: {
    width: 96,
    height: 96,
    borderRadius: AppBorderRadius.lg,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: AppSpacing.sm,
    marginTop: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.primary,
  },
  originalPrice: {
    fontSize: 13,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: AppSpacing.sm,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray500,
  },
  deliveryWrap: {
    paddingHorizontal: AppSpacing.base,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: AppSpacing.base,
    marginTop: AppSpacing.md,
  },
  inStockText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.success,
  },
  lowStockText: {
    fontSize: 13,
    color: AppColors.accent,
  },
  outOfStockText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.error,
  },
  variantsSection: {
    paddingHorizontal: AppSpacing.base,
    marginTop: AppSpacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray700,
    marginBottom: AppSpacing.sm,
  },
  variantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  variantChip: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppBorderRadius.lg,
    borderWidth: 2,
    borderColor: AppColors.gray200,
  },
  variantChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: `${AppColors.primary}10`,
  },
  variantChipDisabled: {
    opacity: 0.4,
  },
  variantChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  variantChipTextActive: {
    color: AppColors.primary,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    marginTop: AppSpacing.lg,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
  },
  quantityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    width: 32,
    textAlign: 'center',
    fontWeight: '700',
    color: AppColors.gray900,
  },
  addToCartButton: {
    marginHorizontal: AppSpacing.base,
    marginTop: AppSpacing.lg,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.lg,
    paddingVertical: AppSpacing.md,
    alignItems: 'center',
  },
  addToCartButtonDisabled: {
    opacity: 0.5,
  },
  addToCartText: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.white,
  },
})

// ============================================
// TechTools Mobile App - Product Detail Screen
// ============================================

import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  AppColors,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
} from '@/constants/appTheme'
import { productsApi } from '@/api'
import { Product, ProductMedia } from '@/types'
import {
  formatPrice,
  calculateDiscount,
  getProductMedia,
  generateStarRating,
} from '@/utils'
import { useCartStore, useWishlistStore } from '@/stores'
import { ProductCard } from '@/components'

const { width } = Dimensions.get('window')

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)

  const addToCart = useCartStore((state) => state.addItem)
  const { isInWishlist, toggleItem } = useWishlistStore()

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const productData = await productsApi.getBySlug(slug as string)
        setProduct(productData)

        // Fetch related products
        const related = await productsApi.getRelated(productData.id, 6)
        setRelatedProducts(related)
      } catch (error) {
        console.error('Error fetching product:', error)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchProduct()
    }
  }, [slug])

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={AppColors.primary} />
      </SafeAreaView>
    )
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons
          name='alert-circle-outline'
          size={64}
          color={AppColors.gray300}
        />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const images = getProductMedia(product)
  const basePrice = Number(product.base_price)
  const salePrice = product.sale_price ? Number(product.sale_price) : null
  const hasDiscount = salePrice !== null && salePrice < basePrice
  const discountPercent = hasDiscount
    ? calculateDiscount(basePrice, salePrice!)
    : 0
  const inWishlist = isInWishlist(product.id)
  const stars = generateStarRating(product.average_rating || 0)

  // Render media item (image or video)
  const renderMediaItem = ({ item }: { item: ProductMedia }) => {
    if (item.type === 'video') {
      return (
        <View style={styles.mediaContainer}>
          <Video
            source={{ uri: item.url }}
            style={styles.mainImage}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
          />
        </View>
      )
    }
    return (
      <Image
        source={{ uri: item.url }}
        style={styles.mainImage}
        resizeMode='contain'
      />
    )
  }

  const handleAddToCart = () => {
    addToCart(product, quantity)
    // Show toast or feedback
  }

  const handleBuyNow = () => {
    addToCart(product, quantity)
    router.push('/cart')
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons name='arrow-back' size={24} color={AppColors.gray800} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => toggleItem(product)}
            >
              <Ionicons
                name={inWishlist ? 'heart' : 'heart-outline'}
                size={24}
                color={inWishlist ? AppColors.error : AppColors.gray800}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/cart')}
            >
              <Ionicons
                name='cart-outline'
                size={24}
                color={AppColors.gray800}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Image/Video Gallery */}
          <View style={styles.imageGallery}>
            <FlatList
              horizontal
              pagingEnabled
              data={images}
              keyExtractor={(item) => item.id}
              renderItem={renderMediaItem}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width)
                setActiveImageIndex(index)
              }}
              showsHorizontalScrollIndicator={false}
            />

            {/* Media indicators */}
            <View style={styles.imageIndicators}>
              {images.map((item, index) => (
                <View
                  key={item.id || index}
                  style={[
                    styles.indicator,
                    activeImageIndex === index && styles.activeIndicator,
                  ]}
                >
                  {item.type === 'video' && (
                    <Ionicons
                      name='play'
                      size={6}
                      color={activeImageIndex === index ? AppColors.white : AppColors.gray600}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* Discount badge */}
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discountPercent}%</Text>
              </View>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.category}>{product.category_name}</Text>
            <Text style={styles.name}>{product.name}</Text>

            {/* Rating */}
            <View style={styles.ratingRow}>
              <View style={styles.stars}>
                {stars.map((star, index) => (
                  <Ionicons
                    key={index}
                    name={
                      star === 'full'
                        ? 'star'
                        : star === 'half'
                        ? 'star-half'
                        : 'star-outline'
                    }
                    size={16}
                    color={AppColors.warning}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {Number(product.average_rating || 0).toFixed(1)} (
                {product.review_count || 0} reviews)
              </Text>
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {formatPrice(salePrice ?? basePrice)}
              </Text>
              {hasDiscount && (
                <Text style={styles.originalPrice}>
                  {formatPrice(basePrice)}
                </Text>
              )}
            </View>

            {/* Stock status */}
            <View style={styles.stockRow}>
              <View
                style={[
                  styles.stockBadge,
                  product.total_stock > 0 ? styles.inStock : styles.outOfStock,
                ]}
              >
                <Text style={styles.stockText}>
                  {product.total_stock > 0
                    ? `In Stock (${product.total_stock})`
                    : 'Out of Stock'}
                </Text>
              </View>
            </View>

            {/* Quantity selector */}
            <View style={styles.quantitySection}>
              <Text style={styles.sectionTitle}>Quantity</Text>
              <View style={styles.quantitySelector}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Ionicons name='remove' size={20} color={AppColors.gray600} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    setQuantity(Math.min(product.total_stock, quantity + 1))
                  }
                >
                  <Ionicons name='add' size={20} color={AppColors.gray600} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Description */}
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {product.description || product.short_description}
              </Text>
            </View>

            {/* Specifications */}
            {product.specifications && product.specifications.length > 0 && (
              <View style={styles.specsSection}>
                <Text style={styles.sectionTitle}>Specifications</Text>
                {product.specifications.map((spec, index) => (
                  <View key={index} style={styles.specRow}>
                    <Text style={styles.specKey}>{spec.spec_key}</Text>
                    <Text style={styles.specValue}>{spec.spec_value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>Related Products</Text>
              <FlatList
                horizontal
                data={relatedProducts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.relatedCard}>
                    <ProductCard product={item} showAddToCart={false} />
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedList}
              />
            </View>
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.addToCartButton]}
            onPress={handleAddToCart}
            disabled={product.total_stock === 0}
          >
            <Ionicons name='cart-outline' size={20} color={AppColors.primary} />
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.buyNowButton]}
            onPress={handleBuyNow}
            disabled={product.total_stock === 0}
          >
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    padding: AppSpacing.xl,
  },
  errorText: {
    fontSize: 18,
    color: AppColors.gray600,
    marginTop: AppSpacing.md,
  },
  backButton: {
    marginTop: AppSpacing.lg,
    paddingVertical: AppSpacing.sm,
    paddingHorizontal: AppSpacing.lg,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
  },
  backButtonText: {
    color: AppColors.white,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.white,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
  },
  imageGallery: {
    backgroundColor: AppColors.white,
    position: 'relative',
  },
  mainImage: {
    width,
    height: width * 0.8,
  },
  mediaContainer: {
    width,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.gray100,
  },
  imageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: AppSpacing.md,
    gap: AppSpacing.sm,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIndicator: {
    backgroundColor: AppColors.primary,
    width: 24,
  },
  discountBadge: {
    position: 'absolute',
    top: AppSpacing.md,
    left: AppSpacing.md,
    backgroundColor: AppColors.error,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppBorderRadius.md,
  },
  discountText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  productInfo: {
    backgroundColor: AppColors.white,
    padding: AppSpacing.base,
    marginTop: AppSpacing.sm,
  },
  category: {
    fontSize: 12,
    color: AppColors.primary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.gray900,
    marginTop: AppSpacing.xs,
    marginBottom: AppSpacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AppSpacing.md,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
    marginRight: AppSpacing.sm,
  },
  ratingText: {
    fontSize: 14,
    color: AppColors.gray600,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
    marginBottom: AppSpacing.md,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.primary,
  },
  originalPrice: {
    fontSize: 18,
    color: AppColors.gray400,
    textDecorationLine: 'line-through',
  },
  stockRow: {
    marginBottom: AppSpacing.lg,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs,
    borderRadius: AppBorderRadius.sm,
  },
  inStock: {
    backgroundColor: `${AppColors.success}20`,
  },
  outOfStock: {
    backgroundColor: `${AppColors.error}20`,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.success,
  },
  quantitySection: {
    marginBottom: AppSpacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.gray900,
    marginBottom: AppSpacing.sm,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.md,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.gray900,
    minWidth: 40,
    textAlign: 'center',
  },
  descriptionSection: {
    marginBottom: AppSpacing.lg,
  },
  description: {
    fontSize: 14,
    color: AppColors.gray600,
    lineHeight: 22,
  },
  specsSection: {
    marginBottom: AppSpacing.lg,
  },
  specRow: {
    flexDirection: 'row',
    paddingVertical: AppSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  specKey: {
    flex: 1,
    fontSize: 14,
    color: AppColors.gray600,
  },
  specValue: {
    flex: 1,
    fontSize: 14,
    color: AppColors.gray900,
    fontWeight: '500',
  },
  relatedSection: {
    marginTop: AppSpacing.md,
    paddingVertical: AppSpacing.lg,
    backgroundColor: AppColors.white,
  },
  relatedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.gray900,
    paddingHorizontal: AppSpacing.base,
    marginBottom: AppSpacing.md,
  },
  relatedList: {
    paddingHorizontal: AppSpacing.base,
  },
  relatedCard: {
    marginRight: AppSpacing.md,
  },
  actionBar: {
    flexDirection: 'row',
    padding: AppSpacing.base,
    backgroundColor: AppColors.white,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    gap: AppSpacing.md,
    ...AppShadows.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: AppSpacing.md,
    borderRadius: AppBorderRadius.md,
    gap: AppSpacing.sm,
  },
  addToCartButton: {
    backgroundColor: AppColors.white,
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  addToCartText: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  buyNowButton: {
    backgroundColor: AppColors.primary,
  },
  buyNowText: {
    color: AppColors.white,
    fontWeight: '700',
    fontSize: 16,
  },
})

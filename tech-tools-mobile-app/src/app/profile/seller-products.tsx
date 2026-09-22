// ============================================
// TechTools Mobile App - My Store Products Screen
// ============================================
// Mobile port of the web dashboard's "My Store Products" section --
// same /seller/products endpoints, same real pending-review gate and
// real tier-limit enforcement (listing count, price cap) as web.
// Images only for v1 (no product video upload here), matching the same
// scope cut made on web and in the backend for this specific feature.

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { sellerProductsApi, categoriesApi, type SellerProduct } from '@/api'
import { formatPrice } from '@/utils'
import { AppColors, AppSpacing, AppBorderRadius } from '@/constants/appTheme'
import type { Category } from '@/types'

export default function SellerProductsScreen() {
  const router = useRouter()

  const [products, setProducts] = useState<SellerProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const data = await sellerProductsApi.getMine()
      setProducts(data)
    } catch {
      // Soft failure -- the rest of the screen still works.
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setProductsLoading(true)
      try {
        setProducts(await sellerProductsApi.getMine())
      } catch {
        // Soft failure -- the rest of the screen still works.
      } finally {
        setProductsLoading(false)
      }
    }
    init()
    categoriesApi.getAll().then(setCategories).catch(() => setCategories([]))
  }, [])

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrice('')
    setStock('0')
    setCategoryId('')
    setImages([])
    setFormError('')
  }

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setFormError('Photo library access is needed to add images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    })
    if (!result.canceled) {
      setImages(result.assets.slice(0, 10))
    }
  }

  const handleCreate = async () => {
    setFormError('')
    if (!name.trim()) {
      setFormError('Give the product a name.')
      return
    }
    if (!categoryId) {
      setFormError('Choose a category.')
      return
    }
    const numericPrice = Number(price)
    if (!numericPrice || numericPrice <= 0) {
      setFormError('Enter a real price.')
      return
    }

    setSaving(true)
    try {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      const sku = `SLR-${Date.now().toString(36).toUpperCase()}`

      const formData = new FormData()
      formData.append('sku', sku)
      formData.append('name', name)
      formData.append('slug', slug)
      formData.append('description', description)
      formData.append('categoryId', categoryId)
      formData.append('basePrice', String(numericPrice))
      formData.append('stockQuantity', String(Number(stock) || 0))
      images.forEach((asset, index) => {
        // React Native's FormData expects this {uri,name,type} shape for
        // a file part, not a DOM File/Blob -- the RN fetch polyfill
        // handles it, but the DOM lib types this project builds against
        // don't describe it, hence the cast.
        formData.append('images', {
          uri: asset.uri,
          name: asset.fileName || `photo-${index}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        } as unknown as Blob)
      })

      await sellerProductsApi.createMine(formData)
      resetForm()
      await loadProducts()
    } catch (error: any) {
      setFormError(error?.response?.data?.message || 'Could not create the product right now.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId: string) => {
    try {
      await sellerProductsApi.deleteMine(productId)
      setProducts((current) => current.filter((p) => p.id !== productId))
    } catch {
      // Soft failure -- leave the item in the list if the delete failed.
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={AppColors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Store Products</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>List a product</Text>
          <Text style={styles.cardSubtitle}>
            Your own real product -- every listing goes pending an admin&apos;s approval before
            it&apos;s visible or purchasable. Your seller tier caps how many active listings you
            can have and the maximum price.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Product name"
            placeholderTextColor={AppColors.gray400}
            style={styles.input}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[styles.categoryChip, categoryId === category.id && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, categoryId === category.id && styles.categoryChipTextActive]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="Price"
              placeholderTextColor={AppColors.gray400}
              keyboardType="decimal-pad"
              style={[styles.input, styles.rowInput]}
            />
            <TextInput
              value={stock}
              onChangeText={setStock}
              placeholder="Stock"
              placeholderTextColor={AppColors.gray400}
              keyboardType="number-pad"
              style={[styles.input, styles.rowInput]}
            />
          </View>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            placeholderTextColor={AppColors.gray400}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />

          <TouchableOpacity onPress={handlePickImages} style={styles.imagePickerButton}>
            <Ionicons name="images-outline" size={18} color={AppColors.gray700} />
            <Text style={styles.imagePickerText}>
              {images.length > 0 ? `${images.length} image(s) selected` : 'Add images'}
            </Text>
          </TouchableOpacity>

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewRow}>
              {images.map((asset, index) => (
                <Image key={index} source={{ uri: asset.uri }} style={styles.imagePreview} />
              ))}
            </ScrollView>
          )}

          {!!formError && <Text style={styles.errorText}>{formError}</Text>}

          <TouchableOpacity onPress={handleCreate} disabled={saving} style={styles.submitButton}>
            {saving ? (
              <ActivityIndicator color={AppColors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Submit for review</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Your products</Text>
            <Text style={styles.countBadge}>{products.length} total</Text>
          </View>

          {productsLoading ? (
            <ActivityIndicator color={AppColors.primary} style={{ marginTop: AppSpacing.md }} />
          ) : products.length === 0 ? (
            <Text style={styles.emptyText}>No products yet -- list your first one above.</Text>
          ) : (
            products.map((product) => (
              <View key={product.id} style={styles.productRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {formatPrice(product.sale_price ?? product.base_price)} -- stock:{' '}
                    {product.total_stock ?? 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    product.is_active ? styles.statusBadgeLive : styles.statusBadgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      product.is_active ? styles.statusBadgeTextLive : styles.statusBadgeTextPending,
                    ]}
                  >
                    {product.is_active ? 'Live' : 'Pending'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(product.id)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={16} color={AppColors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.base,
    paddingVertical: AppSpacing.sm,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray100,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  scrollContent: {
    padding: AppSpacing.base,
    gap: AppSpacing.base,
  },
  card: {
    backgroundColor: AppColors.white,
    borderRadius: AppBorderRadius.xl,
    padding: AppSpacing.base,
    marginBottom: AppSpacing.base,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.gray900,
  },
  cardSubtitle: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 4,
    marginBottom: AppSpacing.md,
  },
  countBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.gray500,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm + 2,
    fontSize: 14,
    color: AppColors.gray900,
    marginBottom: AppSpacing.sm,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: AppSpacing.sm,
  },
  rowInput: {
    flex: 1,
  },
  categoryRow: {
    marginBottom: AppSpacing.sm,
  },
  categoryChip: {
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.xs + 2,
    borderRadius: AppBorderRadius.full,
    backgroundColor: AppColors.gray100,
    marginRight: AppSpacing.sm,
  },
  categoryChipActive: {
    backgroundColor: AppColors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  categoryChipTextActive: {
    color: AppColors.white,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: AppBorderRadius.md,
    paddingHorizontal: AppSpacing.md,
    paddingVertical: AppSpacing.sm + 2,
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.gray700,
  },
  imagePreviewRow: {
    marginTop: AppSpacing.sm,
  },
  imagePreview: {
    width: 64,
    height: 64,
    borderRadius: AppBorderRadius.md,
    marginRight: AppSpacing.sm,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.error,
    marginTop: AppSpacing.sm,
  },
  submitButton: {
    marginTop: AppSpacing.md,
    backgroundColor: AppColors.primary,
    borderRadius: AppBorderRadius.md,
    paddingVertical: AppSpacing.sm + 4,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.white,
  },
  emptyText: {
    fontSize: 13,
    color: AppColors.gray500,
    marginTop: AppSpacing.sm,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.sm,
    paddingVertical: AppSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    marginTop: AppSpacing.sm,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray900,
  },
  productMeta: {
    fontSize: 12,
    color: AppColors.gray500,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: AppBorderRadius.full,
    paddingHorizontal: AppSpacing.sm,
    paddingVertical: 3,
  },
  statusBadgeLive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextLive: {
    color: '#047857',
  },
  statusBadgeTextPending: {
    color: '#B45309',
  },
  deleteButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

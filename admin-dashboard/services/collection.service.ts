import { apiClient } from '@/lib/api-client'

export interface ProductCollection {
  id: string
  name: string
  slug: string
  description?: string
  visibility: 'public' | 'private' | 'hidden'
  displayOrder: 'manual' | 'newest' | 'popular' | 'price_asc' | 'price_desc'
  itemsCount: number
  startsAt?: string
  endsAt?: string
  metaTitle?: string
  metaDescription?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  products?: any[]
}

export interface CategoryCollection {
  id: string
  name: string
  slug: string
  description?: string
  visibility: 'public' | 'private' | 'hidden'
  displayOrder: 'manual' | 'alphabetical' | 'newest' | 'popular'
  itemsCount: number
  startsAt?: string
  endsAt?: string
  metaTitle?: string
  metaDescription?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  categories?: any[]
}

export interface CreateCollectionData {
  name: string
  slug: string
  description?: string
  shortDescription?: string
  visibility?: 'public' | 'private' | 'hidden'
  displayOrder?: string
  position?: number
  startsAt?: string
  endsAt?: string
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  isActive?: boolean
  isFeatured?: boolean
  imageUrl?: string
  bannerUrl?: string
}

/**
 * Real image/banner file upload -- same shape as category.service.ts's
 * createCategoryWithMedia/updateCategoryWithMedia. Every non-undefined
 * field is appended as a plain string (multer parses the rest of the
 * multipart body the same way it parses categories' -- see
 * resolveCollectionImages in the backend controllers), and the two files
 * are appended last under the field names the backend's upload.fields()
 * middleware expects: `image`, `banner`.
 */
function buildCollectionFormData(
  data: Partial<CreateCollectionData>,
  files: { image?: File; banner?: File },
): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })
  if (files.image) formData.append('image', files.image)
  if (files.banner) formData.append('banner', files.banner)
  return formData
}

export const collectionService = {
  // ============================================
  // PRODUCT COLLECTIONS
  // ============================================

  // Get all product collections
  async getProductCollections(params?: {
    page?: number
    limit?: number
    visibility?: string
    isActive?: boolean
    search?: string
  }) {
    const data = await apiClient.get('/collections/products', { params })
    return data
  },

  // Get single product collection
  async getProductCollection(id: string) {
    const data = await apiClient.get(`/collections/products/${id}`)
    return data
  },

  // Create product collection
  async createProductCollection(collectionData: CreateCollectionData) {
    const data = await apiClient.post(
      '/collections/products',
      collectionData,
    )
    return data
  },

  // Create product collection with a real uploaded image/banner
  async createProductCollectionWithMedia(
    collectionData: CreateCollectionData,
    files: { image?: File; banner?: File },
  ) {
    const formData = buildCollectionFormData(collectionData, files)
    return apiClient.postFormData('/collections/products', formData)
  },

  // Update product collection
  async updateProductCollection(
    id: string,
    collectionData: Partial<CreateCollectionData>,
  ) {
    const data = await apiClient.put(
      `/collections/products/${id}`,
      collectionData,
    )
    return data
  },

  // Update product collection with a real uploaded image/banner
  async updateProductCollectionWithMedia(
    id: string,
    collectionData: Partial<CreateCollectionData>,
    files: { image?: File; banner?: File },
  ) {
    const formData = buildCollectionFormData(collectionData, files)
    return apiClient.putFormData(`/collections/products/${id}`, formData)
  },

  // Delete product collection
  async deleteProductCollection(id: string) {
    const data = await apiClient.delete(`/collections/products/${id}`)
    return data
  },

  // Add products to collection
  async addProductsToCollection(collectionId: string, productIds: string[]) {
    const data = await apiClient.post(
      `/collections/products/${collectionId}/products`,
      {
        productIds,
      },
    )
    return data
  },

  // Remove product from collection
  async removeProductFromCollection(collectionId: string, productId: string) {
    const data = await apiClient.delete(
      `/collections/products/${collectionId}/products/${productId}`,
    )
    return data
  },

  // Reorder products in collection
  async reorderProductsInCollection(
    collectionId: string,
    items: Array<{ productId: string; position: number }>,
  ) {
    const data = await apiClient.put(
      `/collections/products/${collectionId}/products/reorder`,
      { items },
    )
    return data
  },

  // ============================================
  // CATEGORY COLLECTIONS
  // ============================================

  // Get all category collections
  async getCategoryCollections(params?: {
    page?: number
    limit?: number
    visibility?: string
    isActive?: boolean
    search?: string
  }) {
    const data = await apiClient.get('/collections/categories', { params })
    return data
  },

  // Get single category collection
  async getCategoryCollection(id: string) {
    const data = await apiClient.get(`/collections/categories/${id}`)
    return data
  },

  // Create category collection
  async createCategoryCollection(collectionData: CreateCollectionData) {
    const data = await apiClient.post(
      '/collections/categories',
      collectionData,
    )
    return data
  },

  // Create category collection with a real uploaded image/banner
  async createCategoryCollectionWithMedia(
    collectionData: CreateCollectionData,
    files: { image?: File; banner?: File },
  ) {
    const formData = buildCollectionFormData(collectionData, files)
    return apiClient.postFormData('/collections/categories', formData)
  },

  // Update category collection
  async updateCategoryCollection(
    id: string,
    collectionData: Partial<CreateCollectionData>,
  ) {
    const data = await apiClient.put(
      `/collections/categories/${id}`,
      collectionData,
    )
    return data
  },

  // Update category collection with a real uploaded image/banner
  async updateCategoryCollectionWithMedia(
    id: string,
    collectionData: Partial<CreateCollectionData>,
    files: { image?: File; banner?: File },
  ) {
    const formData = buildCollectionFormData(collectionData, files)
    return apiClient.putFormData(`/collections/categories/${id}`, formData)
  },

  // Delete category collection
  async deleteCategoryCollection(id: string) {
    const data = await apiClient.delete(`/collections/categories/${id}`)
    return data
  },

  // Add categories to collection
  async addCategoriesToCollection(collectionId: string, categoryIds: string[]) {
    const data = await apiClient.post(
      `/collections/categories/${collectionId}/categories`,
      {
        categoryIds,
      },
    )
    return data
  },

  // Remove category from collection
  async removeCategoryFromCollection(collectionId: string, categoryId: string) {
    const data = await apiClient.delete(
      `/collections/categories/${collectionId}/categories/${categoryId}`,
    )
    return data
  },

  // Reorder categories in collection
  async reorderCategoriesInCollection(
    collectionId: string,
    items: Array<{ categoryId: string; position: number }>,
  ) {
    const data = await apiClient.put(
      `/collections/categories/${collectionId}/categories/reorder`,
      { items },
    )
    return data
  },
}

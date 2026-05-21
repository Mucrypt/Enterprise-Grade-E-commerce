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
  visibility?: 'public' | 'private' | 'hidden'
  displayOrder?: string
  startsAt?: string
  endsAt?: string
  metaTitle?: string
  metaDescription?: string
  isActive?: boolean
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

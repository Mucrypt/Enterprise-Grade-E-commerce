import apiClient from '@/lib/api-client'
import type { Product, ApiResponse, PaginatedResponse } from '@/types'

export interface CreateProductDTO {
  sku: string
  name: string
  slug: string
  description: string
  shortDescription?: string
  categoryId: string
  brandId?: string
  basePrice: number
  salePrice?: number
  costPrice?: number
  taxRate?: number
  stockQuantity?: number
  weight?: number
  weightUnit?: string
  length?: number
  width?: number
  height?: number
  dimensionsUnit?: string
  isActive?: boolean
  isDigital?: boolean
  isFeatured?: boolean
  isBackorderAllowed?: boolean
  minOrderQuantity?: number
  maxOrderQuantity?: number
  metaTitle?: string
  metaDescription?: string
  deliveryTemplateId?: string | null
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

export interface ProductFilters {
  page?: number
  limit?: number
  categoryId?: string
  brandId?: string
  minPrice?: number
  maxPrice?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  featured?: boolean
  inStock?: boolean
  search?: string
}

export interface BulkUpdateDTO {
  isActive?: boolean
  isFeatured?: boolean
  categoryId?: string
  brandId?: string
  taxRate?: number
}

export const productService = {
  /**
   * Get all products with filters
   */
  async getProducts(
    filters?: ProductFilters,
  ): Promise<PaginatedResponse<Product>> {
    const params = new URLSearchParams()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    return apiClient.get<PaginatedResponse<Product>>(
      `/products?${params.toString()}`,
    )
  },

  /**
   * Get single product by ID
   */
  async getProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
    return apiClient.get<ApiResponse<{ product: Product }>>(`/products/${id}`)
  },

  /**
   * Create new product (JSON only, no media)
   */
  async createProduct(
    data: CreateProductDTO,
  ): Promise<ApiResponse<{ product: Product }>> {
    return apiClient.post<ApiResponse<{ product: Product }>>('/products', data)
  },

  /**
   * Create product with media in single request
   */
  async createProductWithMedia(
    data: CreateProductDTO,
    images?: File[],
    videos?: File[],
  ): Promise<ApiResponse<{ product: Product }>> {
    const formData = new FormData()

    // Add product data as form fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })

    // Add images
    if (images) {
      images.forEach((image) => {
        formData.append('images', image)
      })
    }

    // Add videos
    if (videos) {
      videos.forEach((video) => {
        formData.append('videos', video)
      })
    }

    return apiClient.postFormData<ApiResponse<{ product: Product }>>(
      '/products',
      formData,
    )
  },

  /**
   * Update product
   */
  async updateProduct(
    id: string,
    data: UpdateProductDTO,
  ): Promise<ApiResponse<{ product: Product }>> {
    return apiClient.put<ApiResponse<{ product: Product }>>(
      `/products/${id}`,
      data,
    )
  },

  /**
   * Update product with media
   */
  async updateProductWithMedia(
    id: string,
    data: UpdateProductDTO,
    images?: File[],
    videos?: File[],
  ): Promise<ApiResponse<{ product: Product }>> {
    const formData = new FormData()

    // Add product data as form fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })

    // Add images
    if (images) {
      images.forEach((image) => {
        formData.append('images', image)
      })
    }

    // Add videos
    if (videos) {
      videos.forEach((video) => {
        formData.append('videos', video)
      })
    }

    return apiClient.putFormData<ApiResponse<{ product: Product }>>(
      `/products/${id}`,
      formData,
    )
  },

  /**
   * Delete product (soft delete by default)
   */
  async deleteProduct(
    id: string,
    permanent: boolean = false,
  ): Promise<ApiResponse<{ productId: string; deletedAt?: string }>> {
    const query = permanent ? '?permanent=true' : ''
    return apiClient.delete<
      ApiResponse<{ productId: string; deletedAt?: string }>
    >(`/products/${id}${query}`)
  },

  /**
   * Restore a soft-deleted product
   */
  async restoreProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
    return apiClient.post<ApiResponse<{ product: Product }>>(
      `/products/${id}/restore`,
    )
  },

  /**
   * Bulk delete products
   */
  async bulkDeleteProducts(
    productIds: string[],
    permanent: boolean = false,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<ApiResponse<{ message: string }>>(
      '/products/bulk/delete',
      {
        productIds,
        permanent,
      },
    )
  },

  /**
   * Bulk update products
   */
  async bulkUpdateProducts(
    productIds: string[],
    updates: BulkUpdateDTO,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<ApiResponse<{ message: string }>>(
      '/products/bulk/update',
      {
        productIds,
        updates,
      },
    )
  },

  /**
   * Search products
   */
  async searchProducts(
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Product>> {
    return apiClient.get<PaginatedResponse<Product>>(
      `/products/search?q=${encodeURIComponent(
        query,
      )}&page=${page}&limit=${limit}`,
    )
  },
}

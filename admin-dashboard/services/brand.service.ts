import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export interface Brand {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  website_url?: string
  is_active: boolean
  product_count?: number
  created_at: string
  updated_at: string
}

export interface CreateBrandDTO {
  name: string
  slug?: string
  description?: string
  websiteUrl?: string
  isActive?: boolean
}

export interface UpdateBrandDTO extends Partial<CreateBrandDTO> {}

export interface BrandListParams {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface BrandListResponse {
  brands: Brand[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const brandService = {
  /**
   * Get all brands with filtering and pagination
   */
  async getAllBrands(
    params?: BrandListParams,
  ): Promise<ApiResponse<BrandListResponse>> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.page) queryParams.append('page', String(params.page))
      if (params?.limit) queryParams.append('limit', String(params.limit))
      if (params?.search) queryParams.append('search', params.search)
      if (params?.isActive !== undefined)
        queryParams.append('isActive', String(params.isActive))
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)

      const query = queryParams.toString()
      return await apiClient.get<ApiResponse<BrandListResponse>>(
        `/brands${query ? `?${query}` : ''}`,
      )
    } catch {
      return {
        success: true,
        data: {
          brands: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
      } as ApiResponse<BrandListResponse>
    }
  },

  /**
   * Get all brands (simple version)
   */
  async getBrands(): Promise<ApiResponse<{ brands: Brand[] }>> {
    try {
      return await apiClient.get<ApiResponse<{ brands: Brand[] }>>('/brands')
    } catch {
      return {
        success: true,
        data: { brands: [] },
      } as ApiResponse<{ brands: Brand[] }>
    }
  },

  /**
   * Get single brand by ID
   */
  async getBrand(id: string): Promise<ApiResponse<{ brand: Brand }>> {
    return apiClient.get<ApiResponse<{ brand: Brand }>>(`/brands/${id}`)
  },

  /**
   * Create new brand
   */
  async createBrand(
    data: CreateBrandDTO,
  ): Promise<ApiResponse<{ brand: Brand }>> {
    return apiClient.post<ApiResponse<{ brand: Brand }>>('/brands', data)
  },

  /**
   * Create brand with logo
   */
  async createBrandWithLogo(
    data: CreateBrandDTO,
    logo?: File,
  ): Promise<ApiResponse<{ brand: Brand }>> {
    const formData = new FormData()

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })

    if (logo) {
      formData.append('logo', logo)
    }

    return apiClient.postFormData<ApiResponse<{ brand: Brand }>>(
      '/brands',
      formData,
    )
  },

  /**
   * Update brand
   */
  async updateBrand(
    id: string,
    data: UpdateBrandDTO,
  ): Promise<ApiResponse<{ brand: Brand }>> {
    return apiClient.put<ApiResponse<{ brand: Brand }>>(`/brands/${id}`, data)
  },

  /**
   * Delete brand
   */
  async deleteBrand(id: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete<ApiResponse<unknown>>(`/brands/${id}`)
  },

  /**
   * Bulk update brands
   */
  async bulkUpdateBrands(
    ids: string[],
    data: { is_active?: boolean },
  ): Promise<ApiResponse<{ updated: number }>> {
    return apiClient.post<ApiResponse<{ updated: number }>>(
      '/brands/bulk/update',
      {
        ids,
        data,
      },
    )
  },

  /**
   * Bulk delete brands
   */
  async bulkDeleteBrands(
    ids: string[],
  ): Promise<ApiResponse<{ deleted: number }>> {
    return apiClient.post<ApiResponse<{ deleted: number }>>(
      '/brands/bulk/delete',
      {
        ids,
      },
    )
  },
}

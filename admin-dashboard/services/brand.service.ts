import apiClient from '@/lib/api-client'
import type { ApiResponse } from '@/types'

export interface Brand {
  id: string
  name: string
  slug: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  isActive?: boolean
  createdAt?: string
}

export interface CreateBrandDTO {
  name: string
  slug?: string
  description?: string
  websiteUrl?: string
  isActive?: boolean
}

export interface UpdateBrandDTO extends Partial<CreateBrandDTO> {}

export const brandService = {
  /**
   * Get all brands
   */
  async getBrands(): Promise<ApiResponse<{ brands: Brand[] }>> {
    try {
      return await apiClient.get<ApiResponse<{ brands: Brand[] }>>('/brands')
    } catch {
      // Fallback if brands endpoint doesn't exist yet
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
}

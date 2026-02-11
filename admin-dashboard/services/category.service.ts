import apiClient from '@/lib/api-client'
import type { Category, ApiResponse } from '@/types'

export interface CreateCategoryDTO {
  name: string
  description?: string
  parentId?: string
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {}

export const categoryService = {
  /**
   * Get all categories
   */
  async getCategories(): Promise<ApiResponse<{ categories: Category[] }>> {
    return apiClient.get<ApiResponse<{ categories: Category[] }>>('/categories')
  },

  /**
   * Get single category by ID
   */
  async getCategory(id: string): Promise<ApiResponse<{ category: Category }>> {
    return apiClient.get<ApiResponse<{ category: Category }>>(
      `/categories/${id}`,
    )
  },

  /**
   * Create new category (JSON only, no media)
   */
  async createCategory(
    data: CreateCategoryDTO,
  ): Promise<ApiResponse<{ category: Category }>> {
    return apiClient.post<ApiResponse<{ category: Category }>>(
      '/categories',
      data,
    )
  },

  /**
   * Create category with media
   */
  async createCategoryWithMedia(
    data: CreateCategoryDTO,
    thumbnail?: File,
    banner?: File,
    icon?: File,
    video?: File,
  ): Promise<ApiResponse<{ category: Category }>> {
    const formData = new FormData()

    // Add category data
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })

    // Add media files
    if (thumbnail) formData.append('thumbnail', thumbnail)
    if (banner) formData.append('banner', banner)
    if (icon) formData.append('icon', icon)
    if (video) formData.append('video', video)

    return apiClient.postFormData<ApiResponse<{ category: Category }>>(
      '/categories',
      formData,
    )
  },

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    data: UpdateCategoryDTO,
  ): Promise<ApiResponse<{ category: Category }>> {
    return apiClient.put<ApiResponse<{ category: Category }>>(
      `/categories/${id}`,
      data,
    )
  },

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<ApiResponse<any>> {
    return apiClient.delete<ApiResponse<any>>(`/categories/${id}`)
  },

  /**
   * Get products in category
   */
  async getCategoryProducts(id: string): Promise<ApiResponse<any>> {
    return apiClient.get<ApiResponse<any>>(`/categories/${id}/products`)
  },
}

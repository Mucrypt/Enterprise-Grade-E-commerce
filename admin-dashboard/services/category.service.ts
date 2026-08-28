import apiClient from '@/lib/api-client'
import type { Category, ApiResponse } from '@/types'

export interface CreateCategoryDTO {
  name: string
  slug?: string
  description?: string
  parentId?: string | null
  metaTitle?: string
  metaDescription?: string
  displayOrder?: number
  isActive?: boolean
  showInNavigation?: boolean
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {}

export interface GetCategoriesParams {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
  parentId?: string | null
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedCategoriesResponse {
  categories: Category[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const categoryService = {
  /**
   * Get all active categories (public)
   */
  async getCategories(): Promise<ApiResponse<{ categories: Category[] }>> {
    return apiClient.get<ApiResponse<{ categories: Category[] }>>('/categories')
  },

  /**
   * Get all categories for admin (includes inactive, with pagination)
   */
  async getAllCategories(
    params: GetCategoriesParams = {},
  ): Promise<ApiResponse<PaginatedCategoriesResponse>> {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', String(params.page))
    if (params.limit) queryParams.append('limit', String(params.limit))
    if (params.search) queryParams.append('search', params.search)
    if (params.isActive !== undefined)
      queryParams.append('isActive', String(params.isActive))
    if (params.parentId !== undefined)
      queryParams.append(
        'parentId',
        params.parentId === null ? 'null' : params.parentId,
      )
    if (params.sortBy) queryParams.append('sortBy', params.sortBy)
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)

    return apiClient.get<ApiResponse<PaginatedCategoriesResponse>>(
      `/categories/admin/all?${queryParams.toString()}`,
    )
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
    formData.append('name', data.name)
    if (data.slug) formData.append('slug', data.slug)
    if (data.description) formData.append('description', data.description)
    if (data.parentId) formData.append('parentId', data.parentId)
    if (data.metaTitle) formData.append('metaTitle', data.metaTitle)
    if (data.metaDescription)
      formData.append('metaDescription', data.metaDescription)
    if (data.displayOrder !== undefined)
      formData.append('displayOrder', String(data.displayOrder))
    if (data.isActive !== undefined)
      formData.append('isActive', String(data.isActive))
    if (data.showInNavigation !== undefined)
      formData.append('showInNavigation', String(data.showInNavigation))

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
   * Update category (JSON only)
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
   * Update category with media
   */
  async updateCategoryWithMedia(
    id: string,
    data: UpdateCategoryDTO,
    files: {
      thumbnail?: File
      banner?: File
      icon?: File
      video?: File
    },
  ): Promise<ApiResponse<{ category: Category }>> {
    const formData = new FormData()

    // Add category data
    if (data.name) formData.append('name', data.name)
    if (data.slug) formData.append('slug', data.slug)
    if (data.description !== undefined)
      formData.append('description', data.description || '')
    if (data.parentId !== undefined)
      formData.append('parentId', data.parentId || '')
    if (data.metaTitle) formData.append('metaTitle', data.metaTitle)
    if (data.metaDescription)
      formData.append('metaDescription', data.metaDescription)
    if (data.displayOrder !== undefined)
      formData.append('displayOrder', String(data.displayOrder))
    if (data.isActive !== undefined)
      formData.append('isActive', String(data.isActive))
    if (data.showInNavigation !== undefined)
      formData.append('showInNavigation', String(data.showInNavigation))

    // Add media files
    if (files.thumbnail) formData.append('thumbnail', files.thumbnail)
    if (files.banner) formData.append('banner', files.banner)
    if (files.icon) formData.append('icon', files.icon)
    if (files.video) formData.append('video', files.video)

    return apiClient.putFormData<ApiResponse<{ category: Category }>>(
      `/categories/${id}`,
      formData,
    )
  },

  /**
   * Delete category (soft delete)
   */
  async deleteCategory(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/categories/${id}`,
    )
  },

  /**
   * Restore deleted category
   */
  async restoreCategory(
    id: string,
  ): Promise<ApiResponse<{ category: Category }>> {
    return apiClient.post<ApiResponse<{ category: Category }>>(
      `/categories/${id}/restore`,
    )
  },

  /**
   * Delete category media
   */
  async deleteCategoryMedia(
    categoryId: string,
    mediaId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/categories/${categoryId}/media/${mediaId}`,
    )
  },

  /**
   * Get products in category
   */
  async getCategoryProducts(id: string): Promise<ApiResponse<any>> {
    return apiClient.get<ApiResponse<any>>(`/categories/${id}/products`)
  },

  /**
   * Bulk delete categories
   */
  async bulkDeleteCategories(
    ids: string[],
  ): Promise<ApiResponse<{ deletedCount: number }>> {
    return apiClient.delete<ApiResponse<{ deletedCount: number }>>(
      '/categories/bulk/delete',
      { data: { ids } },
    )
  },

  /**
   * Bulk update categories
   */
  async bulkUpdateCategories(
    ids: string[],
    data: { is_active?: boolean; display_order?: number },
  ): Promise<ApiResponse<{ updatedCount: number }>> {
    return apiClient.put<ApiResponse<{ updatedCount: number }>>(
      '/categories/bulk/update',
      { ids, data },
    )
  },
}

import apiClient from '@/lib/api-client'
import type { MediaFile, ApiResponse } from '@/types'

export interface UploadMediaDTO {
  file: File
  title?: string
  altText?: string
  description?: string
  position?: number
  isPrimary?: boolean
  mediaPurpose?: 'thumbnail' | 'banner' | 'icon' | 'video'
}

export interface UpdateMediaDTO {
  title?: string
  altText?: string
  description?: string
  position?: number
  isPrimary?: boolean
  mediaPurpose?: 'thumbnail' | 'banner' | 'icon' | 'video'
}

export const mediaService = {
  // ===== PRODUCT MEDIA =====
  
  /**
   * Upload media to product
   */
  async uploadProductMedia(productId: string, data: UploadMediaDTO): Promise<ApiResponse<MediaFile>> {
    const formData = new FormData()
    formData.append('file', data.file)
    
    if (data.title) formData.append('title', data.title)
    if (data.altText) formData.append('altText', data.altText)
    if (data.description) formData.append('description', data.description)
    if (data.position !== undefined) formData.append('position', String(data.position))
    if (data.isPrimary !== undefined) formData.append('isPrimary', String(data.isPrimary))

    return apiClient.postFormData<ApiResponse<MediaFile>>(
      `/products/${productId}/media`,
      formData
    )
  },

  /**
   * Get all media for product
   */
  async getProductMedia(productId: string): Promise<ApiResponse<MediaFile[]>> {
    return apiClient.get<ApiResponse<MediaFile[]>>(`/products/${productId}/media`)
  },

  /**
   * Update product media
   */
  async updateProductMedia(
    productId: string,
    mediaId: string,
    data: UpdateMediaDTO
  ): Promise<ApiResponse<MediaFile>> {
    return apiClient.put<ApiResponse<MediaFile>>(
      `/products/${productId}/media/${mediaId}`,
      data
    )
  },

  /**
   * Delete product media
   */
  async deleteProductMedia(productId: string, mediaId: string): Promise<ApiResponse<any>> {
    return apiClient.delete<ApiResponse<any>>(`/products/${productId}/media/${mediaId}`)
  },

  /**
   * Set primary image
   */
  async setPrimaryImage(productId: string, mediaId: string): Promise<ApiResponse<MediaFile>> {
    return apiClient.put<ApiResponse<MediaFile>>(
      `/products/${productId}/media/${mediaId}/set-primary`,
      {}
    )
  },

  /**
   * Reorder product media
   */
  async reorderProductMedia(
    productId: string,
    mediaOrder: Array<{ mediaId: string; position: number }>
  ): Promise<ApiResponse<MediaFile[]>> {
    return apiClient.put<ApiResponse<MediaFile[]>>(
      `/products/${productId}/media/reorder`,
      { mediaOrder }
    )
  },

  // ===== CATEGORY MEDIA =====

  /**
   * Upload media to category
   */
  async uploadCategoryMedia(categoryId: string, data: UploadMediaDTO): Promise<ApiResponse<MediaFile>> {
    const formData = new FormData()
    formData.append('file', data.file)
    
    if (data.title) formData.append('title', data.title)
    if (data.altText) formData.append('altText', data.altText)
    if (data.mediaPurpose) formData.append('mediaPurpose', data.mediaPurpose)
    if (data.position !== undefined) formData.append('position', String(data.position))

    return apiClient.postFormData<ApiResponse<MediaFile>>(
      `/categories/${categoryId}/media`,
      formData
    )
  },

  /**
   * Get all media for category
   */
  async getCategoryMedia(categoryId: string, type?: 'image' | 'video'): Promise<ApiResponse<MediaFile[]>> {
    const url = type 
      ? `/categories/${categoryId}/media?type=${type}`
      : `/categories/${categoryId}/media`
    return apiClient.get<ApiResponse<MediaFile[]>>(url)
  },

  /**
   * Update category media
   */
  async updateCategoryMedia(
    categoryId: string,
    mediaId: string,
    data: UpdateMediaDTO
  ): Promise<ApiResponse<MediaFile>> {
    return apiClient.put<ApiResponse<MediaFile>>(
      `/categories/${categoryId}/media/${mediaId}`,
      data
    )
  },

  /**
   * Delete category media
   */
  async deleteCategoryMedia(categoryId: string, mediaId: string): Promise<ApiResponse<any>> {
    return apiClient.delete<ApiResponse<any>>(`/categories/${categoryId}/media/${mediaId}`)
  },
}
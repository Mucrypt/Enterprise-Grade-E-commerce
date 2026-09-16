import { apiClient } from '@/lib/api-client'

export type DiscoverMediaType = 'video' | 'image'

export interface DiscoverPost {
  id: string
  media_type: DiscoverMediaType
  video_url: string | null
  video_poster_url: string | null
  caption: string | null
  category_id: string | null
  category_name?: string
  category_slug?: string
  is_active: boolean
  position: number
  view_count: number
  like_count: number
  save_count: number
  share_count: number
  add_to_cart_count: number
  purchase_count: number
  created_at: string
  updated_at: string
  // Admin-list-only field (getAdminDiscoverPosts only).
  product_count?: number
  // getAdminDiscoverPostById only -- the post's current tagged products /
  // image-carousel contents.
  products?: Array<Record<string, unknown> & { id: string }>
  images?: Array<{ id: string; image_url: string; position: number }>
}

export interface DiscoverPostFormData {
  mediaType: DiscoverMediaType
  caption?: string
  categoryId?: string
  isActive?: boolean
  videoUrl?: string
  videoPosterUrl?: string
}

export interface DiscoverPostFiles {
  video?: File
  poster?: File
  images?: File[]
}

function buildDiscoverPostFormData(
  data: Partial<DiscoverPostFormData>,
  files?: DiscoverPostFiles,
): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })
  if (files?.video) formData.append('video', files.video)
  if (files?.poster) formData.append('poster', files.poster)
  if (files?.images) {
    files.images.forEach((file) => formData.append('images', file))
  }
  return formData
}

export const discoverService = {
  async getAll() {
    return apiClient.get('/discover/posts')
  },

  async getById(id: string) {
    return apiClient.get(`/discover/posts/${id}`)
  },

  async create(data: DiscoverPostFormData) {
    return apiClient.post('/discover/posts', data)
  },

  async createWithMedia(data: DiscoverPostFormData, files: DiscoverPostFiles) {
    const formData = buildDiscoverPostFormData(data, files)
    return apiClient.postFormData('/discover/posts', formData)
  },

  async update(id: string, data: Partial<DiscoverPostFormData>) {
    return apiClient.put(`/discover/posts/${id}`, data)
  },

  async updateWithMedia(id: string, data: Partial<DiscoverPostFormData>, files: DiscoverPostFiles) {
    const formData = buildDiscoverPostFormData(data, files)
    return apiClient.putFormData(`/discover/posts/${id}`, formData)
  },

  async delete(id: string) {
    return apiClient.delete(`/discover/posts/${id}`)
  },

  async reorder(order: Array<{ id: string; position: number }>) {
    return apiClient.put('/discover/posts/reorder', { order })
  },

  async addProducts(postId: string, productIds: string[]) {
    return apiClient.post(`/discover/posts/${postId}/products`, { productIds })
  },

  async removeProduct(postId: string, productId: string) {
    return apiClient.delete(`/discover/posts/${postId}/products/${productId}`)
  },

  async reorderProducts(postId: string, items: Array<{ productId: string; position: number }>) {
    return apiClient.put(`/discover/posts/${postId}/products/reorder`, { items })
  },
}

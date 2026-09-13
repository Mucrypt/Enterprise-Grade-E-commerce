import { apiClient } from '@/lib/api-client'

export type HeroSlideType =
  | 'custom'
  | 'product'
  | 'category'
  | 'product_collection'
  | 'category_collection'
  | 'product_grid'

export interface HeroSlide {
  id: string
  slide_type: HeroSlideType
  eyebrow: string | null
  title: string | null
  description: string | null
  image_url: string | null
  cta_label: string | null
  cta_link: string | null
  secondary_cta_label: string | null
  secondary_cta_link: string | null
  product_id: string | null
  category_id: string | null
  product_collection_id: string | null
  category_collection_id: string | null
  is_active: boolean
  position: number
  platform: 'both' | 'web' | 'mobile'
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
  // Admin-list-only fields (getAdminHeroSlides only) -- fall back to the
  // real referenced product/category/collection's own name/photo when
  // this slide has no local title/image override, same fallback the
  // public storefront endpoint already applies.
  display_title?: string | null
  display_image_url?: string | null
}

export interface HeroSlideFormData {
  slideType: HeroSlideType
  eyebrow?: string
  title?: string
  description?: string
  imageUrl?: string
  ctaLabel?: string
  ctaLink?: string
  secondaryCtaLabel?: string
  secondaryCtaLink?: string
  productId?: string
  categoryId?: string
  productCollectionId?: string
  categoryCollectionId?: string
  isActive?: boolean
  position?: number
  platform?: 'both' | 'web' | 'mobile'
  startsAt?: string
  endsAt?: string
}

function buildHeroSlideFormData(
  data: Partial<HeroSlideFormData>,
  file?: File,
): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })
  if (file) formData.append('image', file)
  return formData
}

export const heroSlideService = {
  async getAll() {
    return apiClient.get('/settings/hero-slides')
  },

  async create(data: HeroSlideFormData) {
    return apiClient.post('/settings/hero-slides', data)
  },

  async createWithMedia(data: HeroSlideFormData, file?: File) {
    const formData = buildHeroSlideFormData(data, file)
    return apiClient.postFormData('/settings/hero-slides', formData)
  },

  async update(id: string, data: Partial<HeroSlideFormData>) {
    return apiClient.put(`/settings/hero-slides/${id}`, data)
  },

  async updateWithMedia(id: string, data: Partial<HeroSlideFormData>, file?: File) {
    const formData = buildHeroSlideFormData(data, file)
    return apiClient.putFormData(`/settings/hero-slides/${id}`, formData)
  },

  async delete(id: string) {
    return apiClient.delete(`/settings/hero-slides/${id}`)
  },

  async reorder(order: Array<{ id: string; position: number }>) {
    return apiClient.put('/settings/hero-slides/reorder', { order })
  },

  async addItems(slideId: string, productIds: string[]) {
    return apiClient.post(`/settings/hero-slides/${slideId}/items`, { productIds })
  },

  async removeItem(slideId: string, productId: string) {
    return apiClient.delete(`/settings/hero-slides/${slideId}/items/${productId}`)
  },

  async reorderItems(slideId: string, items: Array<{ productId: string; position: number }>) {
    return apiClient.put(`/settings/hero-slides/${slideId}/items/reorder`, { items })
  },
}

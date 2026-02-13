// Re-export all generated types from database
export * from './generated'

// Type aliases for backward compatibility and convenience
// The generated types use table names (Users, Products, etc.)
import type {
  Users,
  Products,
  Categories,
  ProductMedia,
  CategoryMedia,
  ProductCollections,
  ProductCollectionItems,
  CategoryCollections,
  CategoryCollectionItems,
} from './generated'

// Singular aliases for better ergonomics
export type User = Users
export type Product = Products
export type MediaFile = ProductMedia | CategoryMedia
export type Collection = ProductCollections | CategoryCollections

/**
 * CategoryMediaResponse - Media item as returned by the API (snake_case from PostgreSQL)
 */
export interface CategoryMediaResponse {
  id: string
  category_id: string
  type: string
  media_purpose: string
  url: string
  thumbnail_url?: string
  alt_text?: string
  title?: string
  position?: number
  file_size?: number
  width?: number
  height?: number
  format?: string
  duration?: number
  cdn_urls?: {
    original?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
  }
  file_path?: string
  created_at?: string
  updated_at?: string
}

/**
 * Category - Extended interface matching the actual API response
 * The API returns snake_case fields from PostgreSQL with computed fields
 */
export interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  parent_id?: string | null
  parentId?: string | null // camelCase alias for compatibility
  image_url?: string | null
  meta_title?: string | null
  meta_description?: string | null
  is_active: boolean
  isActive?: boolean // camelCase alias for compatibility
  display_order: number
  displayOrder?: number // camelCase alias for compatibility
  created_at?: string
  updated_at?: string
  // Computed fields from API joins
  parent_name?: string | null
  product_count?: number
  // Related media
  media?: CategoryMediaResponse[] | null
}

/**
 * API Response wrapper type
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

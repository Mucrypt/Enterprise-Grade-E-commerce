// ============================================
// TechTools E-Commerce Store - Type Definitions
// ============================================

// Base Types
export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
}

// Product Types
export interface Product extends BaseEntity {
  sku: string
  name: string
  slug: string
  description: string
  short_description: string
  base_price: number | string
  sale_price: number | string | null
  cost_price: number | string
  category_id: string
  brand_id: string | null
  category_name: string
  category_slug: string
  brand_name: string | null
  brand_slug: string | null
  weight: number | string
  weight_unit: string
  is_active: boolean
  is_featured: boolean
  total_stock: number
  images: ProductImage[] | null
  videos?: ProductVideo[] | null
  media?: ProductMedia[] | null
  specifications?: ProductSpecification[] | null
  inventory?: ProductInventory[]
  average_rating?: number | string
  review_count?: number | string
  meta_title: string | null
  meta_description: string | null
}

export interface ProductSpecification {
  id: string
  spec_key: string
  spec_value: string
  spec_group: string
  display_order: number
}

export interface ProductInventory {
  id: string
  warehouse_location: string
  current_stock: number
  reserved_stock: number
  available_stock: number
  low_stock_threshold: number
}

export interface ProductImage {
  id: string
  url: string
  alt_text: string
  is_primary: boolean
  display_order: number
  type?: 'image'
  position?: number
  cdn_urls?: Record<string, string>
}

export interface ProductVideo {
  id: string
  url: string
  alt_text: string
  is_primary: boolean
  position: number
  type: 'video'
  cdn_urls?: Record<string, string>
  thumbnail_url?: string
  duration?: number
}

export interface ProductMedia {
  id: string
  url: string
  alt_text: string
  is_primary: boolean
  position: number
  type: 'image' | 'video'
  cdn_urls?: Record<string, string>
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  name: string
  price_adjustment: number
  stock: number
  attributes: Record<string, string>
}

// Category Types
export interface Category extends BaseEntity {
  name: string
  slug: string
  description: string
  parent_id: string | null
  image_url: string | null
  display_order: number
  is_active: boolean
  product_count?: number
  children?: Category[]
}

// Brand Types
export interface Brand extends BaseEntity {
  name: string
  slug: string
  description: string
  logo_url: string | null
  website_url: string | null
  is_active: boolean
}

// Collection Types
export interface ProductCollection extends BaseEntity {
  name: string
  slug: string
  description: string
  short_description: string
  image_url: string | null
  is_active: boolean
  is_featured: boolean
  position: number
  products?: Product[]
}

// Cart Types
export interface CartItem {
  id: string
  product: Product
  quantity: number
  variant?: ProductVariant
  selectedOptions?: Record<string, string>
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
}

// User Types
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  is_verified: boolean
  created_at: string
}

export interface Address {
  id: string
  user_id: string
  label: string
  first_name: string
  last_name: string
  address_line_1: string
  address_line_2: string | null
  city: string
  state: string
  postal_code: string
  country: string
  phone: string
  is_default: boolean
}

// Order Types
export interface Order extends BaseEntity {
  order_number: string
  user_id: string
  status: OrderStatus
  payment_status: PaymentStatus
  subtotal: number
  discount: number
  shipping_cost: number
  tax: number
  total: number
  shipping_address: Address
  billing_address: Address
  items: OrderItem[]
  tracking_number: string | null
  notes: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  product_image: string
  sku: string
  quantity: number
  unit_price: number
  total_price: number
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

// Wishlist Types
export interface WishlistItem {
  id: string
  product: Product
  added_at: string
}

// Review Types
export interface Review extends BaseEntity {
  product_id: string
  user_id: string
  user_name: string
  rating: number
  title: string
  comment: string
  is_verified_purchase: boolean
  helpful_count: number
  images: string[]
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: {
    items: T[]
    pagination: Pagination
  }
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Filter Types
export interface ProductFilters {
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  featured?: boolean
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating'
  search?: string
}

// UI Types
export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface NavMenuItem {
  label: string
  href: string
  icon?: React.ReactNode
  children?: NavMenuItem[]
  featured?: boolean
  image?: string
}

export interface PromoBar {
  id: string
  text: string
  link?: string
  bgColor: string
  textColor: string
}

export interface HeroBanner {
  id: string
  title: string
  subtitle: string
  image: string
  cta_text: string
  cta_link: string
  position: 'left' | 'center' | 'right'
}

// Blog Types
export interface BlogAuthor {
  id: string
  display_name: string
  slug: string
  bio: string | null
  avatar_url: string | null
  role: 'author' | 'editor' | 'contributor' | 'guest'
  post_count: number
}

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  post_count: number
  is_active: boolean
}

export interface BlogTag {
  id: string
  name: string
  slug: string
  description: string | null
  post_count: number
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  content_html: string | null
  featured_image_url: string | null
  featured_image_alt: string | null
  featured_video_url: string | null
  featured_video_type: string | null
  author: BlogAuthor | null
  author_id: string | null
  category: BlogCategory | null
  category_id: string | null
  tags: BlogTag[]
  status: 'draft' | 'pending' | 'published' | 'scheduled' | 'archived'
  visibility: 'public' | 'private' | 'password_protected'
  published_at: string | null
  meta_title: string | null
  meta_description: string | null
  reading_time_minutes: number
  word_count: number
  view_count: number
  like_count: number
  comment_count: number
  allow_comments: boolean
  is_featured: boolean
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface BlogFilters {
  category?: string
  tag?: string
  author?: string
  search?: string
  featured?: boolean
}

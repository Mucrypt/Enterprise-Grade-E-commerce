// ============================================
// TechTools Mobile App - Type Definitions
// ============================================

export interface Product {
  id: string
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
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  url: string
  alt_text: string
  is_primary: boolean
  position: number
  type?: 'image'
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
  thumbnail_url?: string
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

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  parent_id: string | null
  is_active: boolean
  display_order: number
  product_count?: number
}

export interface Brand {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website_url: string | null
  is_active: boolean
}

export interface Book {
  id: string
  title: string
  subtitle?: string | null
  slug?: string | null
  author_name?: string | null
  authorName?: string | null
  description?: string | null
  excerpt?: string | null
  cover_image_url?: string | null
  coverImageUrl?: string | null
  price?: number | string | null
  currency?: string | null
  publication_status?: string | null
  publicationStatus?: string | null
  available_formats?: string[]
  availableFormats?: string[]
  sample_url?: string | null
  sampleUrl?: string | null
  created_at?: string
  updated_at?: string
}

export interface BookSampleAccess {
  accessUrl?: string
  access_url?: string
  token?: string
  expiresAt?: string
  expires_at?: string
  format?: string
}

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  is_verified: boolean
  user_type?: string
  is_business_account?: boolean
  business_mode_activated_at?: string | null
  created_at: string
}

export type SellerTier = 'unverified' | 'basic' | 'trusted' | 'pro'
export type SellerVerificationStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'

export interface SellerProfile {
  id: string
  user_id: string
  display_name?: string | null
  handle?: string | null
  bio?: string | null
  tier: SellerTier
  verification_status: SellerVerificationStatus
  max_active_listings: number
  max_product_price?: number | string | null
  is_active: boolean
  is_suspended: boolean
  created_at: string
  updated_at: string
}

export interface SellerVerificationRequest {
  id: string
  user_id: string
  seller_profile_id: string
  requested_tier: SellerTier
  status: SellerVerificationStatus
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface SellerTierConfig {
  tier: SellerTier
  max_active_listings: number
  max_product_price?: number | string | null
  commission_rate?: number | string | null
  requires_phone_verification?: boolean
  requires_id_verification?: boolean
  requires_payment_method?: boolean
  requires_admin_approval?: boolean
  buyer_protection_level?: string | null
  description?: string | null
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

export interface Order {
  id: string
  order_number: string
  user_id: string
  status: OrderStatus
  subtotal: number | string
  tax_amount: number | string
  shipping_amount: number | string
  discount_amount: number | string
  total_amount: number | string
  shipping_address: Address
  billing_address: Address
  items: OrderItem[]
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  product_image: string
  quantity: number
  unit_price: number | string
  total_price: number | string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export interface CartItem {
  id: string
  product: Product
  quantity: number
  variant?: ProductVariant
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  name: string
  price_adjustment: number
  attributes: Record<string, string>
  stock: number
}

export interface Review {
  id: string
  product_id: string
  user_id: string
  user_name: string
  rating: number
  title: string
  comment: string
  is_verified_purchase: boolean
  helpful_count: number
  created_at: string
}

export interface ProductFilters {
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  featured?: boolean
  sortBy?: string
  search?: string
  page?: number
  limit?: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface CreatorActivityItem {
  id: string
  eventType: string
  subjectType: string
  title: string
  description: string
  occurredAt: string
  entityId?: string | null
  entitySlug?: string | null
  entityName?: string | null
  orderId?: string | null
  orderNumber?: string | null
  quantity?: number | null
  amount?: number | null
}

export interface CreatorDashboardActivity {
  items: CreatorActivityItem[]
  pagination: {
    hasMore: boolean
    nextCursor: string | null
    limit: number
  }
  generatedAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

export interface SupportQuickAction {
  type: string
  label: string
  description: string
  href: string
}

export interface SupportRecommendation {
  id: string
  name: string
  slug: string
  price: number
  primaryImage: string | null
  categoryName: string | null
  reason: string
}

export interface SupportVerifiedReview {
  id: string
  productId: string
  productName: string
  productSlug: string
  rating: number
  title: string | null
  comment: string | null
  isVerifiedPurchase: boolean
  createdAt: string
}

export interface SupportProfile {
  customer: {
    id: string
    email: string
    firstName: string
    lastName: string
    fullName: string
    joinedAt: string
    isVerified: boolean
  }
  orderSummary: {
    totalOrders: number
    totalSpent: number
    activeOrders: number
    averageOrderValue: number
    lastOrderAt: string | null
  }
  recentOrder: {
    id: string
    order_number: string
    status: string
    total: number
    created_at: string
  } | null
  loyalty: {
    points: number
    tier: string
    nextTier: string
    pointsToNextTier: number
  }
  verifiedReviews: SupportVerifiedReview[]
  recommendations: SupportRecommendation[]
  smartSuggestions: string[]
  quickActions: SupportQuickAction[]
}

export interface FlashDeal {
  id: string
  product: Product
  discount_percentage: number
  ends_at: string
  badge: 'HOT' | 'FLASH' | 'DEAL'
}

export interface PromoBanner {
  id: string
  title: string
  subtitle: string
  icon: string
  gradient: string[]
}

// ============================================
// Blog Types
// ============================================

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

// ============================================
// Trending & Collections Types
// ============================================

export interface ProductCollection {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  image_url: string | null
  banner_url: string | null
  is_active: boolean
  is_featured: boolean
  visibility: 'public' | 'private' | 'hidden'
  position: number
  display_order: 'manual' | 'newest' | 'popular' | 'price_asc' | 'price_desc'
  items_count: number
  meta_title: string | null
  meta_description: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
  products?: Product[]
}

export interface TrendingBrand extends Brand {
  follower_count: number
  products_sold: number
  new_products_count: number
  is_following?: boolean
  featured_products?: Product[]
}

export interface TrendingHashtag {
  id: string
  name: string
  slug: string
  product_count: number
  image_url: string | null
  is_trending: boolean
}

export interface TrendingSection {
  id: string
  title: string
  type: 'hashtag' | 'brand' | 'collection' | 'category'
  items: ProductCollection[] | TrendingBrand[] | TrendingHashtag[]
}

export interface CollectionFilters {
  featured?: boolean
  active?: boolean
  limit?: number
  page?: number
}

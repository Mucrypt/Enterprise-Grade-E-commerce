// ============================================
// TechTools E-Commerce Store - API Client
// ============================================

import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type {
  Product,
  Category,
  CategoryAttribute,
  CategoryCollection,
  Brand,
  ProductCollection,
  Book,
  BookSampleAccess,
  ProductFilters,
  User,
  Order,
  Address,
  Review,
  ReviewSummary,
  ApiResponse,
  Pagination,
  SupportProfile,
  SellerProfile,
  SellerTierConfig,
  SellerVerificationRequest,
  CreatorProfile,
  CreatorDashboardMetrics,
  CreatorDashboardActivity,
  CreatorBookDraftInput,
  CreatorProductList,
  CreatorProduct,
} from '../types'

// API Configuration
const API_URL =
  import.meta.env.VITE_API_URL || 'https://techtoolstore.com/api/v1'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't auto-redirect on 401 - let the app handle auth state
    // The auth store will clear state when API calls fail
    return Promise.reject(error)
  },
)

// ============================================
// Products API
// ============================================
// Maps the UI-facing sort option to the real {sortBy, sortOrder} pair the
// backend's validSortColumns allowlist actually understands. This used to
// not exist at all -- the raw UI value (e.g. 'price_asc') was sent
// straight through, never matched the allowlist, and every sort option
// silently fell back to newest-first.
const SORT_MAP: Record<
  NonNullable<ProductFilters['sortBy']>,
  { sortBy: string; sortOrder: 'asc' | 'desc' }
> = {
  newest: { sortBy: 'created_at', sortOrder: 'desc' },
  price_asc: { sortBy: 'sale_price', sortOrder: 'asc' },
  price_desc: { sortBy: 'sale_price', sortOrder: 'desc' },
  rating: { sortBy: 'average_rating', sortOrder: 'desc' },
}

export const productsApi = {
  // Get all products with filters
  async getAll(filters?: ProductFilters & { page?: number; limit?: number }) {
    const params = new URLSearchParams()

    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.category) params.append('category', filters.category)
    if (filters?.brand) params.append('brand', filters.brand)
    if (filters?.minPrice) params.append('minPrice', String(filters.minPrice))
    if (filters?.maxPrice) params.append('maxPrice', String(filters.maxPrice))
    if (filters?.minRating) params.append('minRating', String(filters.minRating))
    if (filters?.inStock) params.append('inStock', String(filters.inStock))
    if (filters?.featured) params.append('featured', String(filters.featured))
    if (filters?.sortBy) {
      const mapped = SORT_MAP[filters.sortBy]
      params.append('sortBy', mapped.sortBy)
      params.append('sortOrder', mapped.sortOrder)
    }
    if (filters?.search) params.append('search', filters.search)
    if (filters?.attributes) {
      for (const [name, value] of Object.entries(filters.attributes)) {
        if (value) params.append(`attributes[${name}]`, value)
      }
    }

    const response = await api.get<{
      success: boolean
      data: { products: Product[]; pagination: Pagination }
    }>(`/products?${params.toString()}`)

    return response.data.data
  },

  // Get single product by slug
  async getBySlug(slug: string) {
    const response = await api.get<{
      success: boolean
      data: { product: Product }
    }>(`/products/${slug}`)
    return response.data.data.product
  },

  // Get featured products
  async getFeatured(limit = 8) {
    const response = await api.get<{
      success: boolean
      data: { products: Product[] }
    }>(`/products?featured=true&limit=${limit}`)
    return response.data.data.products
  },

  // Search products
  async search(query: string, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: { products: Product[] }
    }>(`/products?search=${encodeURIComponent(query)}&limit=${limit}`)
    return response.data.data.products
  },

  // Get related products
  async getRelated(productId: string, limit = 4) {
    const response = await api.get<{
      success: boolean
      data: Product[]
    }>(`/products/${productId}/related?limit=${limit}`)
    return response.data.data
  },

  // Get the admin-configured delivery date-range estimate for one product,
  // optionally narrowed by an explicit ISO country code (defaults to the
  // server's own IP-based guess when omitted).
  async getDeliveryEstimate(productId: string, countryCode?: string) {
    const params = new URLSearchParams({ productId })
    if (countryCode) params.append('country', countryCode)
    const response = await api.get<{
      success: boolean
      data: {
        scopeMatched: 'product_override' | 'category' | 'location' | 'global'
        templateName: string
        standardLabel: string
        standardDateFrom: string
        standardDateTo: string
        expressLabel: string | null
        expressDate: string | null
        resolvedCountry: string | null
        resolvedCountryName: string | null
        resolvedVia: 'query' | 'geoip' | 'none'
        freeShippingThreshold: number | null
      }
    }>(`/shipping/delivery-estimate?${params.toString()}`)
    return response.data.data
  },
}

// ============================================
// Shipping API
// ============================================
export const shippingApi = {
  // The one public subset of shipping_settings -- just the free-shipping
  // threshold, no auth required. See tech-tools-api's
  // getPublicShippingSettings.
  async getPublicSettings() {
    const response = await api.get<{
      success: boolean
      data: { freeShippingThreshold: number | null }
    }>('/shipping/settings/public')
    return response.data.data
  },
}

// ============================================
// Affiliates API (Refer & Earn)
// ============================================
export const affiliatesApi = {
  // Public -- the real, admin-configured flat rate, never hardcoded in UI copy.
  async getPublicSettings() {
    const response = await api.get<{
      success: boolean
      data: { commissionRatePercent: number; programEnabled: boolean }
    }>('/affiliates/settings/public')
    return response.data.data
  },

  // Public, fire-and-forget -- never throws in a way callers need to handle.
  async trackClick(payload: { code: string; path: string; visitorId: string }) {
    try {
      await api.post('/affiliates/click', payload)
    } catch {
      // best-effort -- a failed click ping must never break navigation
    }
  },

  // Get-or-create -- returns the caller's own referral code, creating it on first call.
  async getMyProfile() {
    const response = await api.get<{
      success: boolean
      data: { referralCode: string; status: 'active' | 'suspended' }
    }>('/affiliates/me')
    return response.data.data
  },

  async getMyStats() {
    const response = await api.get<{
      success: boolean
      data: {
        referralCode: string
        status: 'active' | 'suspended'
        totalClicks: number
        pendingEarnings: number
        confirmedEarnings: number
        pendingCount: number
        confirmedCount: number
        storeCreditBalance: number
        recentReferrals: {
          id: string
          orderValue: number
          commissionAmount: number
          status: 'pending' | 'confirmed' | 'cancelled' | 'paid'
          createdAt: string
          confirmedAt: string | null
        }[]
      }
    }>('/affiliates/me/stats')
    return response.data.data
  },

  async getMyStoreCredit() {
    const response = await api.get<{
      success: boolean
      data: { balance: number }
    }>('/affiliates/me/store-credit')
    return response.data.data
  },
}

// ============================================
// Categories API
// ============================================
export const categoriesApi = {
  // Get all categories
  async getAll() {
    const response = await api.get<{
      success: boolean
      data: { categories: Category[] }
    }>('/categories')
    return response.data.data.categories
  },

  // Get category by slug with products
  async getBySlug(slug: string) {
    const response = await api.get<ApiResponse<Category>>(`/categories/${slug}`)
    return response.data.data
  },

  // Get category tree (hierarchical)
  async getTree() {
    const response = await api.get<{
      success: boolean
      data: { categories: Category[] }
    }>('/categories?tree=true')
    return response.data.data.categories
  },

  // Structured attribute definitions for this category -- only
  // 'select'-type ones carry real filter value, but text/number are
  // returned too (for display elsewhere).
  async getAttributes(categoryId: string) {
    const response = await api.get<{
      success: boolean
      data: { attributes: CategoryAttribute[] }
    }>(`/categories/${categoryId}/attributes`)
    return response.data.data.attributes
  },
}

// ============================================
// Category Collections API -- real, admin-curated cross-category
// merchandising campaigns (e.g. "Autumn Power Tools Sale"), each with a
// real banner and a real set of linked categories, gated server-side to
// only ever return one that's genuinely active/public/within its
// scheduled window.
// ============================================
export const categoryCollectionsApi = {
  async getBySlug(slug: string) {
    const response = await api.get<{
      success: boolean
      data: CategoryCollection
    }>(`/collections/categories/slug/${slug}`)
    return response.data.data
  },

  // Admin-curated shell list (no linked categories in this response --
  // fetch each one's full detail via getBySlug when the categories are
  // actually needed for rendering).
  async getAll(filters?: { featured?: boolean; limit?: number }) {
    const params = new URLSearchParams()
    if (filters?.featured) params.set('featured', 'true')
    if (filters?.limit) params.set('limit', String(filters.limit))

    const response = await api.get<{
      success: boolean
      data: CategoryCollection[]
    }>(`/collections/categories?${params.toString()}`)
    return response.data.data
  },

  async getFeatured(limit = 5) {
    return categoryCollectionsApi.getAll({ featured: true, limit })
  },
}

// ============================================
// Brands API
// ============================================
export const brandsApi = {
  // Get all brands
  async getAll() {
    const response = await api.get<{
      success: boolean
      data: { brands: Brand[] }
    }>('/brands')
    return response.data.data.brands
  },

  // Get brand by slug
  async getBySlug(slug: string) {
    const response = await api.get<ApiResponse<Brand>>(`/brands/${slug}`)
    return response.data.data
  },
}

// ============================================
// Collections API
// ============================================
export const collectionsApi = {
  // Get all product collections
  async getAll(filters?: {
    featured?: boolean
    limit?: number
    search?: string
  }) {
    const params = new URLSearchParams()
    if (filters?.featured) params.set('featured', 'true')
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.search) params.set('search', filters.search)

    const response = await api.get<{
      success: boolean
      data: ProductCollection[]
    }>(`/collections/products?${params.toString()}`)
    return response.data.data
  },

  // Get collection by slug with products
  async getBySlug(slug: string) {
    const response = await api.get<ApiResponse<ProductCollection>>(
      `/collections/products/${slug}`,
    )
    return response.data.data
  },

  // Get featured collections
  async getFeatured(limit = 10) {
    return collectionsApi.getAll({ featured: true, limit })
  },
}

// ============================================
// Books API
// ============================================
export const booksApi = {
  async getAll(filters?: {
    page?: number
    limit?: number
    search?: string
    format?: string
  }) {
    const params = new URLSearchParams()

    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.search) params.set('search', filters.search)
    if (filters?.format) params.set('format', filters.format)

    const query = params.toString()
    const response = await api.get<{
      success: boolean
      data: { books?: Book[]; items?: Book[]; data?: Book[] } | Book[]
    }>(query ? `/books?${query}` : '/books')

    return response.data.data
  },

  async getById(id: string) {
    const response = await api.get<{
      success: boolean
      data: Book
    }>(`/books/${id}`)

    return response.data.data
  },

  async getSampleAccess(id: string) {
    const response = await api.get<{
      success: boolean
      data: BookSampleAccess | { access?: BookSampleAccess }
    }>(`/books/${id}/sample`)

    return response.data.data
  },
}

// ============================================
// Auth API
// ============================================
export const authApi = {
  // Login
  async login(email: string, password: string) {
    const response = await api.post<{
      success: boolean
      data: {
        user: {
          id: string
          email: string
          firstName: string
          lastName: string
          userType: string
          emailVerified: boolean
          createdAt: string
        }
        tokens: {
          accessToken: string
          refreshToken: string
        }
      }
    }>('/auth/login', { email, password })

    const { user: apiUser, tokens } = response.data.data
    localStorage.setItem('auth_token', tokens.accessToken)
    localStorage.setItem('refresh_token', tokens.refreshToken)

    // Map camelCase to snake_case
    return {
      user: {
        id: apiUser.id,
        email: apiUser.email,
        first_name: apiUser.firstName,
        last_name: apiUser.lastName,
        phone: null,
        avatar_url: null,
        is_verified: apiUser.emailVerified,
        user_type: apiUser.userType,
        is_business_account: false,
        business_mode_activated_at: null,
        created_at: apiUser.createdAt,
      } as User,
      token: tokens.accessToken,
    }
  },

  // Register
  async register(data: {
    email: string
    password: string
    firstName: string
    lastName: string
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        user: {
          id: string
          email: string
          firstName: string
          lastName: string
          userType: string
          createdAt: string
        }
        tokens: {
          accessToken: string
          refreshToken: string
        }
      }
    }>('/auth/register', data)

    const { user: apiUser, tokens } = response.data.data
    localStorage.setItem('auth_token', tokens.accessToken)
    localStorage.setItem('refresh_token', tokens.refreshToken)

    // Map camelCase to snake_case
    return {
      user: {
        id: apiUser.id,
        email: apiUser.email,
        first_name: apiUser.firstName,
        last_name: apiUser.lastName,
        phone: null,
        avatar_url: null,
        is_verified: false,
        user_type: apiUser.userType,
        is_business_account: false,
        business_mode_activated_at: null,
        created_at: apiUser.createdAt,
      } as User,
      token: tokens.accessToken,
    }
  },

  // Get current user
  async getCurrentUser() {
    const response = await api.get<{
      success: boolean
      data: {
        user: {
          id: string
          email: string
          firstName: string
          lastName: string
          userType: string
          emailVerified: boolean
          createdAt: string
        }
      }
    }>('/auth/me')

    const apiUser = response.data.data.user
    // Map camelCase API response to snake_case frontend User type
    return {
      id: apiUser.id,
      email: apiUser.email,
      first_name: apiUser.firstName,
      last_name: apiUser.lastName,
      phone: null,
      avatar_url: null,
      is_verified: apiUser.emailVerified,
      user_type: apiUser.userType,
      is_business_account: false,
      business_mode_activated_at: null,
      created_at: apiUser.createdAt,
    } as User
  },

  // Logout. Call the backend BEFORE clearing the token -- /auth/logout reads
  // the Bearer token to know which refresh token to delete from Redis, so
  // clearing it first (as this used to) meant the request always went out
  // unauthenticated and the server-side session was never actually revoked.
  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors -- always clear client-side regardless
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
  },

  // Forgot password
  async forgotPassword(email: string) {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/auth/forgot-password',
      { email },
    )
    return response.data
  },

  // Reset password
  async resetPassword(token: string, password: string) {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/auth/reset-password',
      { token, password },
    )
    return response.data
  },
}

// ============================================
// User API
// ============================================
export const userApi = {
  // Update profile. Backend expects camelCase and returns { user: {...} },
  // not the user object directly -- see user.controller.ts updateProfile.
  async updateProfile(data: {
    first_name?: string
    last_name?: string
    phone?: string
  }) {
    const response = await api.put<{
      success: boolean
      data: {
        user: {
          id: string
          email: string
          firstName: string
          lastName: string
          phone?: string
        }
      }
    }>('/users/profile', {
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
    })
    return response.data.data.user
  },

  // Get addresses
  async getAddresses() {
    const response = await api.get<{
      success: boolean
      data: { addresses: Address[] }
    }>('/users/addresses')
    return response.data.data.addresses
  },

  // Add address
  async addAddress(data: Omit<Address, 'id' | 'user_id'>) {
    const response = await api.post<ApiResponse<Address>>(
      '/users/addresses',
      data,
    )
    return response.data.data
  },

  // Update address
  async updateAddress(id: string, data: Partial<Address>) {
    const response = await api.put<ApiResponse<Address>>(
      `/users/addresses/${id}`,
      data,
    )
    return response.data.data
  },

  // Delete address
  async deleteAddress(id: string) {
    await api.delete(`/users/addresses/${id}`)
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/user/change-password',
      { currentPassword, newPassword },
    )
    return response.data
  },

  // Activate business mode and bootstrap creator profile
  async activateBusinessMode(payload?: {
    displayName?: string
    handle?: string
    companyName?: string
    businessType?: string
    source?: string
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        user: {
          id: string
          email: string
          userType: string
          companyName?: string | null
          businessType?: string | null
          isBusinessAccount: boolean
          businessModeActivatedAt?: string | null
        }
        creatorProfile?: {
          id: string
          user_id: string
          handle: string
          display_name: string
          verification_status: string
        } | null
      }
    }>('/users/business-mode/activate', {
      source: 'web_store_settings',
      ...(payload || {}),
    })

    return response.data.data
  },
}

export const sellerApi = {
  async getTierConfig() {
    const response = await api.get<{
      success: boolean
      data: {
        tiers: SellerTierConfig[]
      }
    }>('/seller/tiers')

    return response.data.data.tiers
  },

  async getMyProfile() {
    const response = await api.get<{
      success: boolean
      data: {
        sellerProfile: SellerProfile | null
        eligible: boolean
      }
    }>('/seller/me')

    return response.data.data
  },

  async onboard(payload: {
    displayName?: string
    handle?: string
    bio?: string
    termsAccepted: boolean
    source?: string
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        sellerProfile: SellerProfile
      }
    }>('/seller/onboard', {
      source: 'web_store_settings',
      ...payload,
    })

    return response.data.data
  },

  async requestVerification(payload: {
    requestedTier: 'basic' | 'trusted' | 'pro'
    notes?: string
    documentsSubmitted?: unknown[]
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        request: SellerVerificationRequest
      }
    }>('/seller/verification-requests', payload)

    return response.data.data
  },

  async getVerificationRequests() {
    const response = await api.get<{
      success: boolean
      data: {
        requests: SellerVerificationRequest[]
      }
    }>('/seller/verification-requests')

    return response.data.data.requests
  },
}

export const creatorApi = {
  normalizeProduct(raw: any): CreatorProduct {
    return {
      id: String(raw?.id || ''),
      name: String(raw?.name || ''),
      slug: String(raw?.slug || ''),
      publicationStatus: String(
        raw?.publicationStatus ?? raw?.publication_status ?? 'draft',
      ),
      basePrice: Number(raw?.basePrice ?? raw?.base_price ?? 0),
      salePrice:
        raw?.salePrice !== undefined
          ? raw.salePrice === null
            ? null
            : Number(raw.salePrice)
          : raw?.sale_price === null || raw?.sale_price === undefined
          ? null
          : Number(raw.sale_price),
      shortDescription: (raw?.shortDescription ??
        raw?.short_description ??
        null) as string | null,
      coverImageUrl: (raw?.coverImageUrl ?? raw?.cover_image_url ?? null) as
        | string
        | null,
      totalUnitsSold: Number(raw?.totalUnitsSold ?? raw?.total_units_sold ?? 0),
      createdAt: String(
        raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
      ),
      updatedAt: String(
        raw?.updatedAt ?? raw?.updated_at ?? new Date().toISOString(),
      ),
    }
  },

  async getMyProfile() {
    const response = await api.get<{
      success: boolean
      data: {
        profile: CreatorProfile
      }
    }>('/creator/profile/me')

    return response.data.data.profile
  },

  async upsertMyProfile(payload: {
    handle: string
    displayName: string
    bio?: string
    avatarUrl?: string
    websiteUrl?: string
    socialLinks?: Record<string, unknown>
    payoutAddress?: string
    isPublic?: boolean
  }) {
    const response = await api.put<{
      success: boolean
      data: {
        profile: CreatorProfile
      }
    }>('/creator/profile/me', payload)

    return response.data.data.profile
  },

  async getDashboardMetrics() {
    const response = await api.get<{
      success: boolean
      data: CreatorDashboardMetrics
    }>('/creator/dashboard/metrics')

    return response.data.data
  },

  async getDashboardActivity(limit = 10, cursor?: string | null) {
    const params = new URLSearchParams({
      limit: String(limit),
    })

    if (cursor) {
      params.set('cursor', cursor)
    }

    const response = await api.get<{
      success: boolean
      data: CreatorDashboardActivity
    }>(`/creator/dashboard/activity?${params.toString()}`)

    return response.data.data
  },

  async createBook(payload: CreatorBookDraftInput) {
    const response = await api.post<{
      success: boolean
      data: {
        book: {
          id: string
          name: string
          slug: string
          product_kind?: string
        }
      }
    }>('/creator/books', payload)

    return response.data.data.book
  },

  async submitBookForReview(bookId: string, payload?: { notes?: string }) {
    const response = await api.post<{
      success: boolean
      data: {
        book: {
          id: string
          publication_status: string
          submitted_for_review_at?: string | null
        }
      }
    }>(`/creator/books/${bookId}/submit`, {
      rightsDeclared: true,
      creatorTermsAccepted: true,
      ...(payload || {}),
    })

    return response.data.data.book
  },

  async getMyProducts(params?: {
    page?: number
    limit?: number
    status?: string
    search?: string
  }): Promise<CreatorProductList> {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    const response = await api.get<{
      success: boolean
      data: CreatorProductList
    }>(`/creator/products?${qs.toString()}`)
    const data = response.data.data as any
    return {
      items: Array.isArray(data?.items)
        ? data.items.map((item: any) => creatorApi.normalizeProduct(item))
        : [],
      pagination: {
        page: Number(data?.pagination?.page || params?.page || 1),
        limit: Number(data?.pagination?.limit || params?.limit || 8),
        hasMore: Boolean(data?.pagination?.hasMore),
      },
    }
  },

  async updateMyProduct(
    productId: string,
    payload: {
      basePrice?: number
      salePrice?: number | null
      description?: string
      shortDescription?: string
    },
  ): Promise<CreatorProduct> {
    const response = await api.patch<{
      success: boolean
      data: { product: CreatorProduct }
    }>(`/creator/products/${productId}`, payload)
    return creatorApi.normalizeProduct(response.data.data.product)
  },
}

// ============================================
// Orders API
// ============================================
export const ordersApi = {
  // Get user orders
  async getAll(page = 1, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: { orders: Order[]; pagination: Pagination }
    }>(`/user/orders?page=${page}&limit=${limit}`)
    return response.data.data
  },

  // Get single order
  async getById(id: string) {
    const response = await api.get<ApiResponse<Order>>(`/user/orders/${id}`)
    return response.data.data
  },

  // Create order
  async create(data: {
    items: { product_id: string; quantity: number; variant_id?: string }[]
    shipping_address_id: string
    billing_address_id: string
    payment_method: string
    coupon_code?: string
    notes?: string
  }) {
    const response = await api.post<ApiResponse<Order>>('/orders', data)
    return response.data.data
  },

  // Cancel order
  async cancel(id: string, reason: string) {
    const response = await api.post<ApiResponse<Order>>(
      `/orders/${id}/cancel`,
      { reason },
    )
    return response.data.data
  },

  // Track order
  async track(orderNumber: string) {
    const response = await api.get<
      ApiResponse<{
        status: string
        events: { date: string; status: string; description: string }[]
      }>
    >(`/orders/track/${orderNumber}`)
    return response.data.data
  },
}

// ============================================
// Blog API
// ============================================
import type {
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogAuthor,
  BlogFilters,
} from '../types'

export const blogApi = {
  // Get published posts with pagination
  async getPosts(filters?: BlogFilters & { page?: number; limit?: number }) {
    const params = new URLSearchParams()

    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.category) params.append('category', filters.category)
    if (filters?.tag) params.append('tag', filters.tag)
    if (filters?.author) params.append('author', filters.author)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.featured) params.append('featured', String(filters.featured))

    const response = await api.get<{
      success: boolean
      data: { posts: BlogPost[]; pagination: Pagination }
    }>(`/blog/posts?${params.toString()}`)

    return response.data.data
  },

  // Get single post by slug
  async getPostBySlug(slug: string) {
    const response = await api.get<{
      success: boolean
      data: BlogPost
    }>(`/blog/posts/${slug}`)
    return response.data.data
  },

  // Get featured posts
  async getFeaturedPosts(limit = 5) {
    const response = await api.get<{
      success: boolean
      data: { posts: BlogPost[] }
    }>(`/blog/posts?featured=true&limit=${limit}`)
    return response.data.data.posts
  },

  // Get categories
  async getCategories() {
    const response = await api.get<{
      success: boolean
      data: BlogCategory[]
    }>('/blog/categories')
    return response.data.data || []
  },

  // Get single category
  async getCategoryBySlug(slug: string) {
    const response = await api.get<{
      success: boolean
      data: { category: BlogCategory }
    }>(`/blog/categories/${slug}`)
    return response.data.data.category
  },

  // Get tags
  async getTags() {
    const response = await api.get<{
      success: boolean
      data: BlogTag[]
    }>('/blog/tags')
    return response.data.data || []
  },

  // Get authors
  async getAuthors() {
    const response = await api.get<{
      success: boolean
      data: BlogAuthor[]
    }>('/blog/authors')
    return response.data.data || []
  },

  // Get single author
  async getAuthorBySlug(slug: string) {
    const response = await api.get<{
      success: boolean
      data: { author: BlogAuthor; posts: BlogPost[] }
    }>(`/blog/authors/${slug}`)
    return response.data.data
  },

  // Search posts
  async searchPosts(query: string, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: { posts: BlogPost[] }
    }>(`/blog/posts?search=${encodeURIComponent(query)}&limit=${limit}`)
    return response.data.data.posts
  },

  // Get related posts
  async getRelatedPosts(slug: string, limit = 3) {
    const response = await api.get<{
      success: boolean
      data: BlogPost[]
    }>(`/blog/posts/${slug}/related?limit=${limit}`)
    return response.data.data || []
  },
}

// ============================================
// Wishlist API
// ============================================
export const wishlistApi = {
  // Get wishlist
  async get() {
    const response = await api.get<{
      success: boolean
      data: { product_id: string; product: Product }[]
    }>('/user/wishlist')
    return response.data.data
  },

  // Add to wishlist
  async add(productId: string) {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/user/wishlist',
      { product_id: productId },
    )
    return response.data
  },

  // Remove from wishlist
  async remove(productId: string) {
    await api.delete(`/user/wishlist/${productId}`)
  },

  // Check if in wishlist
  async check(productId: string) {
    const response = await api.get<ApiResponse<{ in_wishlist: boolean }>>(
      `/user/wishlist/check/${productId}`,
    )
    return response.data.data.in_wishlist
  },
}

// ============================================
// Reviews API
// ============================================
export const reviewsApi = {
  // Get product reviews -- public, no auth. Was previously pointed at
  // /products/:id/reviews, a route that doesn't exist anywhere in
  // product.routes.ts (a dead 404 endpoint); the real one lives under
  // review.routes.ts, mounted at /reviews.
  async getByProduct(productId: string, page = 1, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: { reviews: Review[]; summary: ReviewSummary | null }
      pagination: Pagination
    }>(`/reviews/product/${productId}?page=${page}&limit=${limit}`)
    return { ...response.data.data, pagination: response.data.pagination }
  },

  // Add review
  async create(
    productId: string,
    data: {
      rating: number
      title: string
      comment: string
      images?: string[]
    },
  ) {
    const response = await api.post<ApiResponse<Review>>('/reviews', {
      productId,
      ...data,
    })
    return response.data.data
  },

  // Mark review helpful
  async markHelpful(reviewId: string) {
    const response = await api.post<ApiResponse<{ helpful_count: number }>>(
      `/reviews/${reviewId}/helpful`,
    )
    return response.data.data
  },
}

// ============================================
// Cart API (for server-side cart if needed)
// ============================================
export const cartApi = {
  // Sync cart with server
  async sync(
    items: { product_id: string; quantity: number; variant_id?: string }[],
  ) {
    const response = await api.post<
      ApiResponse<{
        items: { product: Product; quantity: number }[]
        total: number
      }>
    >('/cart/sync', { items })
    return response.data.data
  },

  // Validate cart before checkout
  async validate(items: { product_id: string; quantity: number }[]) {
    const response = await api.post<
      ApiResponse<{
        valid: boolean
        errors: { product_id: string; message: string }[]
        updated_items: { product_id: string; available_stock: number }[]
      }>
    >('/cart/validate', { items })
    return response.data.data
  },

  // Apply coupon
  async applyCoupon(code: string, subtotal: number) {
    const response = await api.post<
      ApiResponse<{
        valid: boolean
        discount: number
        discount_type: 'percentage' | 'fixed'
        message: string
      }>
    >('/cart/coupon', { code, subtotal })
    return response.data.data
  },
}

// ============================================
// Payments API (Stripe Integration)
// ============================================
export const paymentsApi = {
  // Get Stripe publishable key
  async getConfig() {
    const response = await api.get<{
      success: boolean
      data: { publishableKey: string }
    }>('/payments/config')
    return response.data.data
  },

  // Create payment intent
  async createPaymentIntent(data: {
    items: { productId: string; price: number; quantity: number }[]
    shippingAddress?: {
      name: string
      address: string
      apartment?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    currency?: string
    savePaymentMethod?: boolean
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        clientSecret: string
        paymentIntentId: string
        amount: number
        currency: string
      }
    }>('/payments/intent', data)
    return response.data.data
  },

  // Update payment intent (when cart changes)
  async updatePaymentIntent(data: {
    paymentIntentId: string
    items?: { productId: string; price: number; quantity: number }[]
    shippingAddress?: {
      name: string
      address: string
      apartment?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  }) {
    const response = await api.put<{
      success: boolean
      data: {
        clientSecret: string
        paymentIntentId: string
        amount: number
      }
    }>('/payments/intent', data)
    return response.data.data
  },

  // Get payment intent status
  async getPaymentStatus(paymentIntentId: string) {
    const response = await api.get<{
      success: boolean
      data: {
        id: string
        status: string
        amount: number
        currency: string
      }
    }>(`/payments/intent/${paymentIntentId}`)
    return response.data.data
  },

  // Create setup intent for saving cards
  async createSetupIntent() {
    const response = await api.post<{
      success: boolean
      data: {
        clientSecret: string
        customerId: string
      }
    }>('/payments/methods/setup')
    return response.data.data
  },

  // Get saved payment methods
  async getPaymentMethods() {
    const response = await api.get<{
      success: boolean
      data: {
        paymentMethods: Array<{
          id: string
          type: string
          brand?: string
          last4?: string
          expMonth?: number
          expYear?: number
          isDefault: boolean
        }>
      }
    }>('/payments/methods')
    return response.data.data.paymentMethods
  },

  // Remove payment method
  async removePaymentMethod(methodId: string) {
    await api.delete(`/payments/methods/${methodId}`)
  },

  // Set default payment method
  async setDefaultPaymentMethod(paymentMethodId: string) {
    const response = await api.put<{
      success: boolean
      message: string
    }>('/payments/methods/default', { paymentMethodId })
    return response.data
  },

  // Get payment history
  async getPaymentHistory(page = 1, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: {
        payments: Array<{
          id: string
          orderId: string
          orderNumber: string
          amount: number
          currency: string
          status: string
          paidAt: string
          createdAt: string
        }>
        pagination: Pagination
      }
    }>(`/payments/history?page=${page}&limit=${limit}`)
    return response.data.data
  },
}

// ============================================
// Orders API (Updated with Stripe integration)
// ============================================
export const ordersApiNew = {
  // Create an order draft + Stripe PaymentIntent together, BEFORE payment is
  // confirmed -- the order always exists before any money can be captured.
  async checkoutSession(data: {
    items: { productId: string; quantity: number }[]
    shippingAddress: {
      firstName: string
      lastName: string
      email: string
      phone?: string
      address: string
      apartment?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    billingAddress?: {
      firstName: string
      lastName: string
      address: string
      apartment?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    customerNotes?: string
    /** Read from the ttref attribution cookie (see utils/referral-cookie.ts), if present. */
    referralCode?: string
    /** Redeem the caller's store-credit balance against this order -- authenticated checkout only. */
    useStoreCredit?: boolean
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        clientSecret: string
        paymentIntentId: string
        orderId: string
        orderNumber: string
        currency: string
        taxAmount: number
        shippingAmount: number
        grandTotal: number
        storeCreditApplied: number
      }
    }>('/orders/checkout-session', data)
    return response.data.data
  },

  // Guest equivalent of checkoutSession (no authentication required)
  async guestCheckoutSession(data: {
    items: { productId: string; quantity: number }[]
    shippingAddress: any
    guestEmail: string
    guestPhone?: string
    customerNotes?: string
    /** Read from the ttref attribution cookie, if present. No store-credit option for guests -- no account to hold a balance. */
    referralCode?: string
  }) {
    const guestApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    const response = await guestApi.post<{
      success: boolean
      data: {
        clientSecret: string
        paymentIntentId: string
        orderId: string
        orderNumber: string
        checkoutToken: string
        currency: string
        taxAmount: number
        shippingAmount: number
        grandTotal: number
      }
    }>('/orders/guest/checkout-session', data)
    return response.data.data
  },

  // Create order with Stripe payment
  async create(data: {
    items: { productId: string; quantity: number }[]
    shippingAddress: {
      firstName: string
      lastName: string
      email: string
      phone?: string
      address: string
      apartment?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    billingAddress?: {
      firstName: string
      lastName: string
      address: string
      apartment?: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    paymentIntentId: string
    paymentMethod?: string
    customerNotes?: string
  }) {
    const response = await api.post<{
      success: boolean
      data: {
        order: {
          id: string
          order_number: string
          order_status: string
          payment_status: string
          grand_total: number
          shipping_address: object
          items: Array<{
            id: string
            product_name: string
            quantity: number
            unit_price: number
            total_price: number
          }>
          created_at: string
        }
      }
    }>('/orders', data)
    return response.data.data.order
  },

  // Get user orders
  async getAll(page = 1, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: {
        orders: Array<{
          id: string
          order_number: string
          order_status: string
          payment_status: string
          grand_total: number
          created_at: string
          item_count: number
        }>
        pagination: Pagination
      }
    }>(`/orders?page=${page}&limit=${limit}`)
    return response.data.data
  },

  // Get single order
  async getById(id: string) {
    const response = await api.get<{
      success: boolean
      data: {
        order: {
          id: string
          order_number: string
          order_status: string
          payment_status: string
          total_amount: number
          tax_amount: number
          shipping_amount: number
          grand_total: number
          shipping_address: object
          items: Array<{
            id: string
            product_id: string
            product_name: string
            quantity: number
            unit_price: number
            total_price: number
          }>
          created_at: string
        }
      }
    }>(`/orders/${id}`)
    return response.data.data.order
  },

  // Cancel order
  async cancel(id: string, reason?: string) {
    const response = await api.put<{
      success: boolean
      data: { order: object }
    }>(`/orders/${id}/cancel`, { reason })
    return response.data.data.order
  },

  // Public order tracking by order number + email (no authentication required)
  async track(orderNumber: string, email: string) {
    const trackApi = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    })
    const response = await trackApi.get<{
      success: boolean
      data: {
        orderNumber: string
        orderStatus: string
        paymentStatus: string
        createdAt: string
        estimatedDelivery: string | null
        items: Array<{
          productName: string
          quantity: number
          itemStatus: string
          trackingNumber: string | null
          carrier: string | null
          shippedAt: string | null
          deliveredAt: string | null
        }>
      }
    }>('/orders/track', { params: { orderNumber, email } })
    return response.data.data
  },

  // Create guest order (no authentication required)
  async createGuestOrder(data: {
    items: { productId: string; quantity: number }[]
    shippingAddress: any
    guestEmail: string
    guestPhone?: string
    paymentIntentId: string
    paymentMethod?: string
    customerNotes?: string
  }) {
    // Create a new axios instance without auth header for guest checkout
    const guestApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    const response = await guestApi.post<{
      success: boolean
      data: {
        orderId: string
        orderNumber: string
        checkoutToken: string
        email: string
        grandTotal: number
      }
    }>('/orders/guest/create', data)

    return {
      id: response.data.data.orderId,
      order_number: response.data.data.orderNumber,
      grand_total: response.data.data.grandTotal,
      checkoutToken: response.data.data.checkoutToken,
    }
  },

  // Get guest order (no authentication required)
  async getGuestOrder(email: string, token: string) {
    const guestApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    const response = await guestApi.get<{
      success: boolean
      data: any
    }>(
      `/orders/guest/retrieve?email=${encodeURIComponent(
        email,
      )}&token=${token}`,
    )

    return response.data.data
  },
}

// ============================================
// Newsletter API
// ============================================
export const newsletterApi = {
  // Subscribe to newsletter
  async subscribe(data: { email: string; name?: string; source?: string }) {
    const response = await api.post<{
      success: boolean
      message: string
      alreadySubscribed?: boolean
      resubscribed?: boolean
    }>('/newsletter/subscribe', data)
    return response.data
  },

  // Unsubscribe from newsletter
  async unsubscribe(email: string) {
    const response = await api.post<{
      success: boolean
      message: string
    }>('/newsletter/unsubscribe', { email })
    return response.data
  },
}

// ============================================
// Support API
// ============================================
export const supportApi = {
  async getProfile() {
    const response = await api.get<{
      success: boolean
      data: SupportProfile
    }>('/contact/support/profile')

    return response.data.data
  },
}

// Export the axios instance for custom requests
export { api }
export default api

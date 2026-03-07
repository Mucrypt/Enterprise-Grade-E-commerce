// ============================================
// TechTools E-Commerce Store - API Client
// ============================================

import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type {
  Product,
  Category,
  Brand,
  ProductCollection,
  ProductFilters,
  User,
  Order,
  Address,
  Review,
  ApiResponse,
  Pagination,
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
    if (filters?.inStock) params.append('inStock', String(filters.inStock))
    if (filters?.featured) params.append('featured', String(filters.featured))
    if (filters?.sortBy) params.append('sortBy', filters.sortBy)
    if (filters?.search) params.append('search', filters.search)

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
  async getAll() {
    const response = await api.get<{
      success: boolean
      data: ProductCollection[]
    }>('/collections/products')
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
  async getFeatured() {
    const response = await api.get<{
      success: boolean
      data: ProductCollection[]
    }>('/collections/products?featured=true')
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
      created_at: apiUser.createdAt,
    } as User
  },

  // Logout
  async logout() {
    localStorage.removeItem('auth_token')
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors
    }
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
  // Update profile
  async updateProfile(data: Partial<User>) {
    const response = await api.put<ApiResponse<User>>('/user/profile', data)
    return response.data.data
  },

  // Get addresses
  async getAddresses() {
    const response = await api.get<{
      success: boolean
      data: Address[]
    }>('/user/addresses')
    return response.data.data
  },

  // Add address
  async addAddress(data: Omit<Address, 'id' | 'user_id'>) {
    const response = await api.post<ApiResponse<Address>>(
      '/user/addresses',
      data,
    )
    return response.data.data
  },

  // Update address
  async updateAddress(id: string, data: Partial<Address>) {
    const response = await api.put<ApiResponse<Address>>(
      `/user/addresses/${id}`,
      data,
    )
    return response.data.data
  },

  // Delete address
  async deleteAddress(id: string) {
    await api.delete(`/user/addresses/${id}`)
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.post<ApiResponse<{ message: string }>>(
      '/user/change-password',
      { currentPassword, newPassword },
    )
    return response.data
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
  // Get product reviews
  async getByProduct(productId: string, page = 1, limit = 10) {
    const response = await api.get<{
      success: boolean
      data: { reviews: Review[]; pagination: Pagination; averageRating: number }
    }>(`/products/${productId}/reviews?page=${page}&limit=${limit}`)
    return response.data.data
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
    const response = await api.post<ApiResponse<Review>>(
      `/products/${productId}/reviews`,
      data,
    )
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

// Export the axios instance for custom requests
export { api }
export default api

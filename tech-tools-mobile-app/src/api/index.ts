// ============================================
// TechTools Mobile App - API Client
// ============================================

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios'
import * as SecureStore from 'expo-secure-store'
import {
  Product,
  Category,
  Brand,
  User,
  Order,
  Address,
  Review,
  ProductFilters,
  Pagination,
  ApiResponse,
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogAuthor,
  BlogFilters,
  ProductCollection,
} from '../types'

// API Configuration
const API_BASE_URL = 'https://techtoolstore.com/api/v1'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Token management
const getAccessToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync('accessToken')
}

const getRefreshToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync('refreshToken')
}

const setTokens = async (
  accessToken: string,
  refreshToken: string,
): Promise<void> => {
  await SecureStore.setItemAsync('accessToken', accessToken)
  await SecureStore.setItemAsync('refreshToken', refreshToken)
}

const clearTokens = async (): Promise<void> => {
  await SecureStore.deleteItemAsync('accessToken')
  await SecureStore.deleteItemAsync('refreshToken')
}

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// Response interceptor - Handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = await getRefreshToken()
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            response.data.data?.tokens || response.data.tokens || response.data

          await setTokens(newAccessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        await clearTokens()
      }
    }

    return Promise.reject(error)
  },
)

// ============================================
// Auth API
// ============================================
export const authApi = {
  login: async (
    email: string,
    password: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const response = await apiClient.post('/auth/login', { email, password })
    const data = response.data.data || response.data

    const tokens = data.tokens || data
    const accessToken = tokens.accessToken || tokens.access_token
    const refreshToken = tokens.refreshToken || tokens.refresh_token

    await setTokens(accessToken, refreshToken)

    const rawUser = data.user || data
    const user: User = {
      id: rawUser.id,
      email: rawUser.email,
      first_name: rawUser.firstName || rawUser.first_name,
      last_name: rawUser.lastName || rawUser.last_name,
      phone: rawUser.phone,
      avatar_url: rawUser.avatarUrl || rawUser.avatar_url,
      is_verified: rawUser.isVerified || rawUser.is_verified,
      created_at: rawUser.createdAt || rawUser.created_at,
    }

    return { user, accessToken, refreshToken }
  },

  register: async (data: {
    email: string
    password: string
    firstName: string
    lastName: string
  }): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const response = await apiClient.post('/auth/register', data)
    const responseData = response.data.data || response.data

    const tokens = responseData.tokens || responseData
    const accessToken = tokens.accessToken || tokens.access_token
    const refreshToken = tokens.refreshToken || tokens.refresh_token

    await setTokens(accessToken, refreshToken)

    const rawUser = responseData.user || responseData
    const user: User = {
      id: rawUser.id,
      email: rawUser.email,
      first_name: rawUser.firstName || rawUser.first_name,
      last_name: rawUser.lastName || rawUser.last_name,
      phone: rawUser.phone,
      avatar_url: rawUser.avatarUrl || rawUser.avatar_url,
      is_verified: rawUser.isVerified || rawUser.is_verified,
      created_at: rawUser.createdAt || rawUser.created_at,
    }

    return { user, accessToken, refreshToken }
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      await clearTokens()
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me')
    const rawUser =
      response.data.data?.user ||
      response.data.data ||
      response.data.user ||
      response.data

    return {
      id: rawUser.id,
      email: rawUser.email,
      first_name: rawUser.firstName || rawUser.first_name,
      last_name: rawUser.lastName || rawUser.last_name,
      phone: rawUser.phone,
      avatar_url: rawUser.avatarUrl || rawUser.avatar_url,
      is_verified: rawUser.isVerified || rawUser.is_verified,
      created_at: rawUser.createdAt || rawUser.created_at,
    }
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email })
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await getAccessToken()
    return !!token
  },
}

// ============================================
// Products API
// ============================================
export const productsApi = {
  getAll: async (
    filters?: ProductFilters & { page?: number; limit?: number },
  ): Promise<{
    products: Product[]
    pagination: Pagination
  }> => {
    const params = new URLSearchParams()

    if (filters?.category) params.append('category', filters.category)
    if (filters?.brand) params.append('brand', filters.brand)
    if (filters?.minPrice)
      params.append('minPrice', filters.minPrice.toString())
    if (filters?.maxPrice)
      params.append('maxPrice', filters.maxPrice.toString())
    if (filters?.inStock !== undefined)
      params.append('inStock', filters.inStock.toString())
    if (filters?.featured !== undefined)
      params.append('featured', filters.featured.toString())
    if (filters?.sortBy) params.append('sortBy', filters.sortBy)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.limit) params.append('limit', filters.limit.toString())

    const response = await apiClient.get(`/products?${params.toString()}`)
    const data = response.data.data || response.data

    return {
      products: data.products || data,
      pagination: data.pagination || {
        page: 1,
        limit: 20,
        total: data.products?.length || 0,
        totalPages: 1,
      },
    }
  },

  getBySlug: async (slug: string): Promise<Product> => {
    const response = await apiClient.get(`/products/${slug}`)
    const data =
      response.data.data?.product ||
      response.data.data ||
      response.data.product ||
      response.data
    return data
  },

  getById: async (id: string): Promise<Product> => {
    return productsApi.getBySlug(id)
  },

  getFeatured: async (limit = 12): Promise<Product[]> => {
    const response = await apiClient.get(
      `/products?featured=true&limit=${limit}`,
    )
    const data = response.data.data || response.data
    return data.products || data
  },

  getNewArrivals: async (limit = 12): Promise<Product[]> => {
    const response = await apiClient.get(
      `/products?sortBy=created_at:desc&limit=${limit}`,
    )
    const data = response.data.data || response.data
    return data.products || data
  },

  getBestSellers: async (limit = 12): Promise<Product[]> => {
    const response = await apiClient.get(
      `/products?sortBy=sales:desc&limit=${limit}`,
    )
    const data = response.data.data || response.data
    return data.products || data
  },

  getRelated: async (productId: string, limit = 8): Promise<Product[]> => {
    try {
      const response = await apiClient.get(
        `/products/${productId}/related?limit=${limit}`,
      )
      const data = response.data.data || response.data
      return data.products || data
    } catch {
      // Fallback to featured products if no related endpoint
      return productsApi.getFeatured(limit)
    }
  },

  search: async (
    query: string,
    filters?: ProductFilters,
  ): Promise<Product[]> => {
    const result = await productsApi.getAll({ ...filters, search: query })
    return result.products
  },
}

// ============================================
// Categories API
// ============================================
export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await apiClient.get('/categories')
    const data = response.data.data || response.data
    return data.categories || data
  },

  getBySlug: async (slug: string): Promise<Category> => {
    const response = await apiClient.get(`/categories/${slug}`)
    return response.data.data || response.data
  },

  getProducts: async (
    categorySlug: string,
    filters?: ProductFilters,
  ): Promise<{
    products: Product[]
    pagination: Pagination
  }> => {
    return productsApi.getAll({ ...filters, category: categorySlug })
  },
}

// ============================================
// Brands API
// ============================================
export const brandsApi = {
  getAll: async (): Promise<Brand[]> => {
    const response = await apiClient.get('/brands')
    const data = response.data.data || response.data
    return data.brands || data
  },

  getBySlug: async (slug: string): Promise<Brand> => {
    const response = await apiClient.get(`/brands/${slug}`)
    return response.data.data || response.data
  },

  getProducts: async (
    brandSlug: string,
    filters?: ProductFilters,
  ): Promise<{
    products: Product[]
    pagination: Pagination
  }> => {
    return productsApi.getAll({ ...filters, brand: brandSlug })
  },
}

// ============================================
// Orders API
// ============================================
export const ordersApi = {
  getAll: async (): Promise<Order[]> => {
    const response = await apiClient.get('/orders')
    const data = response.data.data || response.data
    return data.orders || data
  },

  getById: async (id: string): Promise<Order> => {
    const response = await apiClient.get(`/orders/${id}`)
    return response.data.data || response.data
  },

  create: async (orderData: {
    items: { productId: string; quantity: number }[]
    shippingAddressId: string
    billingAddressId?: string
    paymentMethod: string
  }): Promise<Order> => {
    const response = await apiClient.post('/orders', orderData)
    return response.data.data || response.data
  },

  cancel: async (id: string): Promise<Order> => {
    const response = await apiClient.post(`/orders/${id}/cancel`)
    return response.data.data || response.data
  },
}

// ============================================
// Addresses API
// ============================================
export const addressesApi = {
  getAll: async (): Promise<Address[]> => {
    const response = await apiClient.get('/addresses')
    const data = response.data.data || response.data
    return data.addresses || data
  },

  create: async (
    addressData: Omit<Address, 'id' | 'user_id'>,
  ): Promise<Address> => {
    const response = await apiClient.post('/addresses', addressData)
    return response.data.data || response.data
  },

  update: async (
    id: string,
    addressData: Partial<Address>,
  ): Promise<Address> => {
    const response = await apiClient.put(`/addresses/${id}`, addressData)
    return response.data.data || response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/addresses/${id}`)
  },

  setDefault: async (id: string): Promise<void> => {
    await apiClient.post(`/addresses/${id}/default`)
  },
}

// ============================================
// Reviews API
// ============================================
export const reviewsApi = {
  getByProduct: async (productId: string): Promise<Review[]> => {
    const response = await apiClient.get(`/products/${productId}/reviews`)
    const data = response.data.data || response.data
    return data.reviews || data
  },

  create: async (
    productId: string,
    reviewData: {
      rating: number
      title: string
      comment: string
    },
  ): Promise<Review> => {
    const response = await apiClient.post(
      `/products/${productId}/reviews`,
      reviewData,
    )
    return response.data.data || response.data
  },

  markHelpful: async (reviewId: string): Promise<void> => {
    await apiClient.post(`/reviews/${reviewId}/helpful`)
  },
}

// ============================================
// Wishlist API
// ============================================
export const wishlistApi = {
  getAll: async (): Promise<Product[]> => {
    const response = await apiClient.get('/wishlist')
    const data = response.data.data || response.data
    return data.items || data.products || data
  },

  add: async (productId: string): Promise<void> => {
    await apiClient.post('/wishlist', { productId })
  },

  remove: async (productId: string): Promise<void> => {
    await apiClient.delete(`/wishlist/${productId}`)
  },

  isInWishlist: async (productId: string): Promise<boolean> => {
    try {
      const items = await wishlistApi.getAll()
      return items.some((item) => item.id === productId)
    } catch {
      return false
    }
  },
}

// Export token management for external use
export { setTokens, clearTokens, getAccessToken }

// ============================================
// Blog API
// ============================================
export const blogApi = {
  // Get published posts with pagination
  getPosts: async (
    filters?: BlogFilters & { page?: number; limit?: number },
  ): Promise<{ posts: BlogPost[]; pagination: Pagination }> => {
    const params = new URLSearchParams()

    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.category) params.append('category', filters.category)
    if (filters?.tag) params.append('tag', filters.tag)
    if (filters?.author) params.append('author', filters.author)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.featured) params.append('featured', String(filters.featured))

    const response = await apiClient.get(`/blog/posts?${params.toString()}`)
    const data = response.data.data || response.data

    return {
      posts: data.posts || data,
      pagination: data.pagination || {
        page: 1,
        limit: 10,
        total: data.posts?.length || 0,
        totalPages: 1,
      },
    }
  },

  // Get single post by slug
  getPostBySlug: async (slug: string): Promise<BlogPost> => {
    const response = await apiClient.get(`/blog/posts/${slug}`)
    return response.data.data || response.data
  },

  // Get featured posts
  getFeaturedPosts: async (limit = 5): Promise<BlogPost[]> => {
    const response = await apiClient.get(
      `/blog/posts?featured=true&limit=${limit}`,
    )
    const data = response.data.data || response.data
    return data.posts || data
  },

  // Get categories
  getCategories: async (): Promise<BlogCategory[]> => {
    const response = await apiClient.get('/blog/categories')
    const data = response.data.data || response.data
    return data.categories || data
  },

  // Get tags
  getTags: async (): Promise<BlogTag[]> => {
    const response = await apiClient.get('/blog/tags')
    const data = response.data.data || response.data
    return data.tags || data
  },

  // Get authors
  getAuthors: async (): Promise<BlogAuthor[]> => {
    const response = await apiClient.get('/blog/authors')
    const data = response.data.data || response.data
    return data.authors || data
  },

  // Search posts
  searchPosts: async (query: string, limit = 10): Promise<BlogPost[]> => {
    const response = await apiClient.get(
      `/blog/posts?search=${encodeURIComponent(query)}&limit=${limit}`,
    )
    const data = response.data.data || response.data
    return data.posts || data
  },

  // Get related posts
  getRelatedPosts: async (slug: string, limit = 3): Promise<BlogPost[]> => {
    try {
      const response = await apiClient.get(
        `/blog/posts/${slug}/related?limit=${limit}`,
      )
      const data = response.data.data || response.data
      return data || []
    } catch {
      return []
    }
  },

  // Record post view
  recordView: async (slug: string): Promise<void> => {
    try {
      await apiClient.post(`/blog/posts/${slug}/view`)
    } catch {
      // Ignore view recording errors
    }
  },
}

// ============================================
// Collections API
// ============================================
export const collectionsApi = {
  // Get all product collections
  getAll: async (filters?: {
    featured?: boolean
    active?: boolean
    limit?: number
    page?: number
  }): Promise<{ collections: ProductCollection[]; pagination: Pagination }> => {
    const params = new URLSearchParams()

    if (filters?.featured) params.append('featured', 'true')
    if (filters?.active !== false) params.append('active', 'true')
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.page) params.append('page', String(filters.page))

    const response = await apiClient.get(
      `/collections/products?${params.toString()}`,
    )
    const data = response.data.data || response.data

    return {
      collections: data.collections || data,
      pagination: data.pagination || {
        page: 1,
        limit: 20,
        total: data.collections?.length || 0,
        totalPages: 1,
      },
    }
  },

  // Get featured collections
  getFeatured: async (limit = 10): Promise<ProductCollection[]> => {
    const result = await collectionsApi.getAll({ featured: true, limit })
    return result.collections
  },

  // Get collection by ID or slug
  getById: async (id: string): Promise<ProductCollection> => {
    const response = await apiClient.get(`/collections/products/${id}`)
    const data = response.data.data || response.data
    return data.collection || data
  },

  // Get products in a collection
  getProducts: async (
    collectionId: string,
    filters?: ProductFilters & { page?: number; limit?: number },
  ): Promise<{ products: Product[]; pagination: Pagination }> => {
    const params = new URLSearchParams()

    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.sortBy) params.append('sortBy', filters.sortBy)

    const response = await apiClient.get(
      `/collections/products/${collectionId}?${params.toString()}`,
    )
    const data = response.data.data || response.data

    return {
      products: data.products || [],
      pagination: data.pagination || {
        page: 1,
        limit: 20,
        total: data.products?.length || 0,
        totalPages: 1,
      },
    }
  },
}

// ============================================
// Trending API (combines collections, brands, categories)
// ============================================
export const trendingApi = {
  // Get trending data for the trending screen
  getTrendingData: async (): Promise<{
    collections: ProductCollection[]
    featuredBrands: Brand[]
    trendingCategories: Category[]
  }> => {
    const [collectionsRes, brandsRes, categoriesRes] = await Promise.all([
      collectionsApi.getFeatured(10),
      brandsApi.getAll(),
      categoriesApi.getAll(),
    ])

    return {
      collections: collectionsRes,
      featuredBrands: brandsRes.slice(0, 10),
      trendingCategories: categoriesRes.slice(0, 10),
    }
  },

  // Get brands with products for store section
  getBrandWithProducts: async (
    brandSlug: string,
    limit = 4,
  ): Promise<{ brand: Brand; products: Product[] }> => {
    const [brand, productsRes] = await Promise.all([
      brandsApi.getBySlug(brandSlug),
      brandsApi.getProducts(brandSlug, { limit }),
    ])

    return {
      brand,
      products: productsRes.products.slice(0, limit),
    }
  },

  // Get multiple brands with their products
  getBrandsWithProducts: async (
    limit = 5,
    productsPerBrand = 4,
  ): Promise<Array<{ brand: Brand; products: Product[] }>> => {
    const brands = await brandsApi.getAll()
    const topBrands = brands.slice(0, limit)

    const brandsWithProducts = await Promise.all(
      topBrands.map(async (brand) => {
        try {
          const productsRes = await brandsApi.getProducts(brand.slug, {
            limit: productsPerBrand,
          })
          return {
            brand,
            products: productsRes.products.slice(0, productsPerBrand),
          }
        } catch {
          return { brand, products: [] }
        }
      }),
    )

    return brandsWithProducts.filter((b) => b.products.length > 0)
  },
}

// ============================================
// Payments API (Stripe Integration)
// ============================================
export interface PaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
  amount: number
  currency: string
}

export interface PaymentMethod {
  id: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
}

export const paymentsApi = {
  // Get Stripe publishable key
  getConfig: async (): Promise<{ publishableKey: string }> => {
    const response = await apiClient.get('/payments/config')
    return response.data.data || response.data
  },

  // Create payment intent
  createPaymentIntent: async (data: {
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
  }): Promise<PaymentIntentResponse> => {
    const response = await apiClient.post('/payments/intent', data)
    return response.data.data || response.data
  },

  // Update payment intent (when cart changes)
  updatePaymentIntent: async (data: {
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
  }): Promise<PaymentIntentResponse> => {
    const response = await apiClient.put('/payments/intent', data)
    return response.data.data || response.data
  },

  // Get payment intent status
  getPaymentStatus: async (
    paymentIntentId: string,
  ): Promise<{
    id: string
    status: string
    amount: number
    currency: string
  }> => {
    const response = await apiClient.get(`/payments/intent/${paymentIntentId}`)
    return response.data.data || response.data
  },

  // Create setup intent for saving cards
  createSetupIntent: async (): Promise<{
    clientSecret: string
    customerId: string
  }> => {
    const response = await apiClient.post('/payments/methods/setup')
    return response.data.data || response.data
  },

  // Get saved payment methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const response = await apiClient.get('/payments/methods')
    const data = response.data.data || response.data
    return data.paymentMethods || data
  },

  // Remove payment method
  removePaymentMethod: async (methodId: string): Promise<void> => {
    await apiClient.delete(`/payments/methods/${methodId}`)
  },

  // Set default payment method
  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<void> => {
    await apiClient.put('/payments/methods/default', { paymentMethodId })
  },
}

// ============================================
// Orders API (Updated with Stripe integration)
// ============================================
export const ordersApiNew = {
  // Create order with Stripe payment
  create: async (data: {
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
  }): Promise<{
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
  }> => {
    const response = await apiClient.post('/orders', data)
    const result = response.data.data || response.data
    return result.order || result
  },

  // Get user orders
  getAll: async (
    page = 1,
    limit = 10,
  ): Promise<{
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
  }> => {
    const response = await apiClient.get(`/orders?page=${page}&limit=${limit}`)
    const data = response.data.data || response.data
    return {
      orders: data.orders || data,
      pagination: data.pagination || {
        page: 1,
        limit: 10,
        total: data.orders?.length || 0,
        totalPages: 1,
      },
    }
  },

  // Get single order
  getById: async (
    id: string,
  ): Promise<{
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
  }> => {
    const response = await apiClient.get(`/orders/${id}`)
    const data = response.data.data || response.data
    return data.order || data
  },

  // Cancel order
  cancel: async (id: string, reason?: string): Promise<object> => {
    const response = await apiClient.put(`/orders/${id}/cancel`, { reason })
    const data = response.data.data || response.data
    return data.order || data
  },
}

// Combined API object for convenience
export const api = {
  auth: authApi,
  products: productsApi,
  categories: categoriesApi,
  brands: brandsApi,
  orders: ordersApi,
  ordersNew: ordersApiNew,
  addresses: addressesApi,
  reviews: reviewsApi,
  wishlist: wishlistApi,
  blog: blogApi,
  collections: collectionsApi,
  trending: trendingApi,
  payments: paymentsApi,
}

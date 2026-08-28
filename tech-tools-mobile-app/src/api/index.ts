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
  Review,
  SupportProfile,
  ProductFilters,
  Pagination,
  ApiResponse,
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogAuthor,
  BlogFilters,
  ProductCollection,
  Book,
  BookSampleAccess,
  SellerProfile,
  SellerTierConfig,
  SellerVerificationRequest,
  CreatorDashboardActivity,
} from '../types'
import { API_BASE_URL } from '../config/env'

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

export interface ApiErrorContext {
  message: string
  statusCode?: number
  isAuthError: boolean
  isNetworkError: boolean
}

export const getApiErrorContext = (
  error: unknown,
  fallbackMessage = 'Something went wrong. Please try again.',
): ApiErrorContext => {
  if (!axios.isAxiosError(error)) {
    return {
      message: fallbackMessage,
      isAuthError: false,
      isNetworkError: false,
    }
  }

  const statusCode = error.response?.status
  const responseData = error.response?.data as
    | { message?: string; error?: string }
    | undefined

  const message =
    responseData?.message ||
    responseData?.error ||
    error.message ||
    fallbackMessage

  return {
    message,
    statusCode,
    isAuthError: statusCode === 401 || statusCode === 403,
    isNetworkError: !error.response,
  }
}

export const getApiErrorMessage = (
  error: unknown,
  fallbackMessage = 'Something went wrong. Please try again.',
): string => getApiErrorContext(error, fallbackMessage).message

type UnknownRecord = Record<string, unknown>

const normalizationWarningCache = new Set<string>()

const createRequestId = (): string => {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `m-${ts}-${rand}`
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toSafeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const toSafeNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const toSafeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

const toSafeBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback

const toSafeArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : []

const getPayloadKeys = (payload: unknown): string[] =>
  isRecord(payload) ? Object.keys(payload).slice(0, 25) : []

const readRequestId = (source: unknown): string | undefined => {
  if (!source) return undefined

  if (isRecord(source)) {
    const direct = source['x-request-id'] ?? source['X-Request-Id']
    if (typeof direct === 'string' && direct.trim().length > 0) {
      return direct
    }

    const internal = source['_requestId']
    if (typeof internal === 'string' && internal.trim().length > 0) {
      return internal
    }

    const getter = source['get']
    if (typeof getter === 'function') {
      const byLower = getter.call(source, 'x-request-id')
      if (typeof byLower === 'string' && byLower.trim().length > 0) {
        return byLower
      }

      const byUpper = getter.call(source, 'X-Request-Id')
      if (typeof byUpper === 'string' && byUpper.trim().length > 0) {
        return byUpper
      }
    }
  }

  return undefined
}

const getRequestIdFromResponse = (response: unknown): string => {
  if (!isRecord(response)) {
    return createRequestId()
  }

  const fromConfig = readRequestId(response.config)
  const fromHeaders = readRequestId(response.headers)
  return fromConfig || fromHeaders || createRequestId()
}

const logNormalizationIssue = (
  endpoint: string,
  issue: string,
  payload: unknown,
  requestId?: string,
) => {
  const cacheKey = `${endpoint}:${issue}`

  if (!normalizationWarningCache.has(cacheKey)) {
    normalizationWarningCache.add(cacheKey)
    console.warn(`[api-normalizer] ${endpoint}: ${issue}`, {
      requestId,
      keys: getPayloadKeys(payload),
    })
  }

  void apiClient
    .post('/security/client-events', {
      action: 'payload_normalization',
      status: 'failed',
      metadata: {
        endpoint,
        issue,
        requestId,
        keys: getPayloadKeys(payload),
      },
      source: 'mobile-app',
      timestamp: new Date().toISOString(),
    })
    .catch(() => {
      // Best-effort only.
    })
}

const normalizeAuthUser = (rawUser: unknown, endpoint: string): User => {
  if (!isRecord(rawUser)) {
    logNormalizationIssue(endpoint, 'Expected user object payload', rawUser)
    return {
      id: '',
      email: '',
      first_name: '',
      last_name: '',
      phone: null,
      avatar_url: null,
      is_verified: false,
      created_at: new Date().toISOString(),
    }
  }

  return {
    id: toSafeString(rawUser.id),
    email: toSafeString(rawUser.email),
    first_name: toSafeString(rawUser.firstName ?? rawUser.first_name),
    last_name: toSafeString(rawUser.lastName ?? rawUser.last_name),
    phone: toSafeNullableString(rawUser.phone),
    avatar_url: toSafeNullableString(rawUser.avatarUrl ?? rawUser.avatar_url),
    is_verified: toSafeBoolean(rawUser.isVerified ?? rawUser.is_verified),
    user_type: toSafeString(rawUser.userType ?? rawUser.user_type, 'customer'),
    is_business_account: toSafeBoolean(
      rawUser.isBusinessAccount ?? rawUser.is_business_account,
      false,
    ),
    business_mode_activated_at: toSafeNullableString(
      rawUser.businessModeActivatedAt ?? rawUser.business_mode_activated_at,
    ),
    created_at:
      toSafeString(rawUser.createdAt ?? rawUser.created_at) ||
      new Date().toISOString(),
  }
}

interface SecurityEventPayload {
  action: string
  status: 'success' | 'failed'
  metadata?: Record<string, unknown>
}

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const requestId = createRequestId()

    ;(
      config as InternalAxiosRequestConfig & { _requestId?: string }
    )._requestId = requestId

    const headers = config.headers as
      | (Record<string, string> & {
          set?: (name: string, value: string) => void
        })
      | undefined

    if (headers?.set) {
      headers.set('x-request-id', requestId)
    } else {
      ;(config.headers as Record<string, string> | undefined) =
        (config.headers as Record<string, string> | undefined) || {}
      ;(config.headers as Record<string, string>)['x-request-id'] = requestId
    }

    const token = await getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// Shared in-flight refresh call. Without this, every request that was racing
// in flight when the access token expired gets its own 401 and would each
// independently POST /auth/refresh with the same refresh token -- the first
// response rotates it, so every refresh call after the first is rejected by
// the server and logs the user out even though the token was actually valid.
// Concurrent 401s now all await this single promise instead.
let refreshPromise: Promise<string> | null = null

const performTokenRefresh = async (): Promise<string> => {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refreshToken,
  })

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    response.data.data?.tokens || response.data.tokens || response.data

  await setTokens(newAccessToken, newRefreshToken)
  return newAccessToken
}

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
        if (!refreshPromise) {
          refreshPromise = performTokenRefresh().finally(() => {
            refreshPromise = null
          })
        }

        const newAccessToken = await refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
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
    const user = normalizeAuthUser(rawUser, '/auth/login')

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
    const user = normalizeAuthUser(rawUser, '/auth/register')

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

    return normalizeAuthUser(rawUser, '/auth/me')
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email })
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await getAccessToken()
    return !!token
  },
}

export const supportApi = {
  getProfile: async (): Promise<SupportProfile> => {
    const response = await apiClient.get<ApiResponse<SupportProfile>>(
      '/contact/support/profile',
    )
    return response.data.data
  },
}

export const contactApi = {
  submit: async (payload: {
    name: string
    email: string
    phone?: string
    subject: string
    orderNumber?: string
    message: string
  }): Promise<{ message: string; ticketNumber: string }> => {
    const response = await apiClient.post('/contact', payload)
    const data = response.data.data || response.data
    return {
      message: data.message || response.data.message,
      ticketNumber: data.ticketNumber || response.data.ticketNumber,
    }
  },
}

export const securityApi = {
  logSensitiveAction: async ({
    action,
    status,
    metadata,
  }: SecurityEventPayload): Promise<void> => {
    const safeMetadata = metadata
      ? Object.fromEntries(
          Object.entries(metadata).filter(
            ([key]) =>
              !['token', 'accessToken', 'refreshToken', 'password'].includes(
                key,
              ),
          ),
        )
      : undefined

    const payload = {
      action,
      status,
      metadata: safeMetadata,
      source: 'mobile-app',
      timestamp: new Date().toISOString(),
    }

    try {
      await apiClient.post('/security/client-events', payload)
    } catch {
      // Best-effort logging only. Do not break user flows if audit endpoint is unavailable.
    }
  },
}

export interface UserAddress {
  id: string
  user_id: string
  address_type: 'shipping' | 'billing'
  full_name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string | null
  country: string
  postal_code: string
  phone: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface UserAddressInput {
  addressType: 'shipping' | 'billing'
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state?: string
  country: string
  postalCode: string
  phone?: string
  isDefault?: boolean
}

interface UserProfilePayload {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    phone: string | null
    userType: string
    companyName: string | null
    businessType?: string | null
    isBusinessAccount: boolean
    businessModeActivatedAt: string | null
    emailVerified: boolean
    phoneVerified: boolean
    isActive: boolean
    lastLogin: string | null
    createdAt: string
    updatedAt: string
  }
  addresses: UserAddress[]
}

const normalizeAddress = (address: any): UserAddress => ({
  id: address.id,
  user_id: address.user_id,
  address_type: address.address_type,
  full_name: address.full_name,
  address_line1: address.address_line1,
  address_line2: address.address_line2 || null,
  city: address.city,
  state: address.state || null,
  country: address.country,
  postal_code: address.postal_code,
  phone: address.phone || null,
  is_default: Boolean(address.is_default),
  created_at: address.created_at,
  updated_at: address.updated_at,
})

const normalizeProfileUser = (rawUser: unknown): UserProfilePayload['user'] => {
  if (!isRecord(rawUser)) {
    logNormalizationIssue(
      '/users/profile',
      'Missing profile user object',
      rawUser,
    )
    return {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      phone: null,
      userType: 'customer',
      companyName: null,
      businessType: null,
      isBusinessAccount: false,
      businessModeActivatedAt: null,
      emailVerified: false,
      phoneVerified: false,
      isActive: true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  return {
    id: toSafeString(rawUser.id),
    email: toSafeString(rawUser.email),
    firstName: toSafeString(rawUser.firstName ?? rawUser.first_name),
    lastName: toSafeString(rawUser.lastName ?? rawUser.last_name),
    phone: toSafeNullableString(rawUser.phone),
    userType: toSafeString(rawUser.userType ?? rawUser.user_type, 'customer'),
    companyName: toSafeNullableString(
      rawUser.companyName ?? rawUser.company_name,
    ),
    businessType: toSafeNullableString(
      rawUser.businessType ?? rawUser.business_type,
    ),
    isBusinessAccount: toSafeBoolean(
      rawUser.isBusinessAccount ?? rawUser.is_business_account,
      false,
    ),
    businessModeActivatedAt: toSafeNullableString(
      rawUser.businessModeActivatedAt ?? rawUser.business_mode_activated_at,
    ),
    emailVerified: toSafeBoolean(
      rawUser.emailVerified ?? rawUser.email_verified,
    ),
    phoneVerified: toSafeBoolean(
      rawUser.phoneVerified ?? rawUser.phone_verified,
    ),
    isActive: toSafeBoolean(rawUser.isActive ?? rawUser.is_active, true),
    lastLogin: toSafeNullableString(rawUser.lastLogin ?? rawUser.last_login),
    createdAt:
      toSafeString(rawUser.createdAt ?? rawUser.created_at) ||
      new Date().toISOString(),
    updatedAt:
      toSafeString(rawUser.updatedAt ?? rawUser.updated_at) ||
      new Date().toISOString(),
  }
}

export const userApi = {
  getProfile: async (): Promise<UserProfilePayload> => {
    const response = await apiClient.get('/users/profile')
    const requestId = getRequestIdFromResponse(response)
    const data = response.data.data || response.data

    if (!isRecord(data)) {
      logNormalizationIssue(
        '/users/profile',
        'Unexpected profile payload shape',
        data,
        requestId,
      )
    }

    return {
      user: normalizeProfileUser(isRecord(data) ? data.user : null),
      addresses: toSafeArray<unknown>(isRecord(data) ? data.addresses : []).map(
        normalizeAddress,
      ),
    }
  },

  updateProfile: async (payload: {
    firstName?: string
    lastName?: string
    phone?: string
    companyName?: string
  }): Promise<UserProfilePayload['user']> => {
    const response = await apiClient.put('/users/profile', payload)
    const requestId = getRequestIdFromResponse(response)
    const data = response.data.data || response.data

    if (!isRecord(data)) {
      logNormalizationIssue(
        '/users/profile',
        'Unexpected profile update payload shape',
        data,
        requestId,
      )
    }

    return normalizeProfileUser(isRecord(data) ? data.user || data : data)
  },

  activateBusinessMode: async (payload?: {
    displayName?: string
    handle?: string
    companyName?: string
    businessType?: string
    source?: string
  }): Promise<{
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
  }> => {
    const response = await apiClient.post('/users/business-mode/activate', {
      source: 'mobile_settings',
      ...(payload || {}),
    })
    const data = response.data.data || response.data

    if (!isRecord(data) || !isRecord(data.user)) {
      logNormalizationIssue(
        '/users/business-mode/activate',
        'Unexpected business mode activation payload shape',
        data,
        getRequestIdFromResponse(response),
      )
    }

    const rawUser = isRecord(data) ? data.user : null
    const rawCreator = isRecord(data) ? data.creatorProfile : null

    return {
      user: {
        id: toSafeString(isRecord(rawUser) ? rawUser.id : ''),
        email: toSafeString(isRecord(rawUser) ? rawUser.email : ''),
        userType: toSafeString(
          isRecord(rawUser) ? rawUser.userType ?? rawUser.user_type : '',
          'customer',
        ),
        companyName: toSafeNullableString(
          isRecord(rawUser)
            ? rawUser.companyName ?? rawUser.company_name
            : null,
        ),
        businessType: toSafeNullableString(
          isRecord(rawUser)
            ? rawUser.businessType ?? rawUser.business_type
            : null,
        ),
        isBusinessAccount: toSafeBoolean(
          isRecord(rawUser)
            ? rawUser.isBusinessAccount ?? rawUser.is_business_account
            : false,
          false,
        ),
        businessModeActivatedAt: toSafeNullableString(
          isRecord(rawUser)
            ? rawUser.businessModeActivatedAt ??
                rawUser.business_mode_activated_at
            : null,
        ),
      },
      creatorProfile: isRecord(rawCreator)
        ? {
            id: toSafeString(rawCreator.id),
            user_id: toSafeString(rawCreator.user_id),
            handle: toSafeString(rawCreator.handle),
            display_name: toSafeString(rawCreator.display_name),
            verification_status: toSafeString(rawCreator.verification_status),
          }
        : null,
    }
  },
}

export const sellerApi = {
  getTierConfig: async (): Promise<SellerTierConfig[]> => {
    const response = await apiClient.get('/seller/tiers')
    const data = response.data?.data || response.data

    return (data?.tiers || []) as SellerTierConfig[]
  },

  getMyProfile: async (): Promise<{
    sellerProfile: SellerProfile | null
    eligible: boolean
  }> => {
    const response = await apiClient.get('/seller/me')
    const data = response.data?.data || response.data

    return {
      sellerProfile: (data?.sellerProfile || null) as SellerProfile | null,
      eligible: Boolean(data?.eligible),
    }
  },

  onboard: async (payload: {
    displayName?: string
    handle?: string
    bio?: string
    termsAccepted: boolean
    source?: string
  }): Promise<{ sellerProfile: SellerProfile }> => {
    const response = await apiClient.post('/seller/onboard', {
      source: 'mobile_settings',
      ...payload,
    })
    const data = response.data?.data || response.data

    return {
      sellerProfile: data.sellerProfile as SellerProfile,
    }
  },

  requestVerification: async (payload: {
    requestedTier: 'basic' | 'trusted' | 'pro'
    notes?: string
    documentsSubmitted?: unknown[]
  }): Promise<{ request: SellerVerificationRequest }> => {
    const response = await apiClient.post(
      '/seller/verification-requests',
      payload,
    )
    const data = response.data?.data || response.data

    return {
      request: data.request as SellerVerificationRequest,
    }
  },

  getVerificationRequests: async (): Promise<SellerVerificationRequest[]> => {
    const response = await apiClient.get('/seller/verification-requests')
    const data = response.data?.data || response.data

    return (data?.requests || []) as SellerVerificationRequest[]
  },
}

export const creatorApi = {
  getDashboardActivity: async (
    limit = 10,
    cursor?: string | null,
  ): Promise<CreatorDashboardActivity> => {
    const params = new URLSearchParams({
      limit: String(limit),
    })

    if (cursor) {
      params.set('cursor', cursor)
    }

    const response = await apiClient.get(
      `/creator/dashboard/activity?${params.toString()}`,
    )
    const data = response.data?.data || response.data

    return {
      items: (data?.items || []) as CreatorDashboardActivity['items'],
      pagination: {
        hasMore: Boolean(data?.pagination?.hasMore),
        nextCursor: data?.pagination?.nextCursor || null,
        limit: Number(data?.pagination?.limit || limit),
      },
      generatedAt: data?.generatedAt || new Date().toISOString(),
    }
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

  // Real per-brand numbers (units sold + product count) -- backs the
  // Trending tab's "Featured Stores" section. There is deliberately no
  // follower count here: no real follow/subscribe feature exists yet, and
  // this endpoint never fabricates one. See tech-tools-api's
  // brand.controller.ts getBrandStats.
  getStats: async (
    ids: string[],
  ): Promise<Record<string, { productCount: number; unitsSold: number; revenueTotal: number; newProductsCount: number }>> => {
    if (ids.length === 0) return {}
    const response = await apiClient.get('/brands/stats', { params: { ids: ids.join(',') } })
    const data = response.data.data || response.data
    return data.stats || {}
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
  getAll: async (): Promise<UserAddress[]> => {
    const response = await apiClient.get('/users/addresses')
    const data = response.data.data || response.data
    return (data.addresses || data || []).map(normalizeAddress)
  },

  create: async (addressData: UserAddressInput): Promise<UserAddress> => {
    const response = await apiClient.post('/users/addresses', addressData)
    const data = response.data.data || response.data
    return normalizeAddress(data.address || data)
  },

  update: async (
    id: string,
    addressData: Partial<UserAddressInput>,
  ): Promise<UserAddress> => {
    const response = await apiClient.put(`/users/addresses/${id}`, addressData)
    const data = response.data.data || response.data
    return normalizeAddress(data.address || data)
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/addresses/${id}`)
  },

  setDefault: async (id: string): Promise<void> => {
    await apiClient.put(`/users/addresses/${id}`, { isDefault: true })
  },
}

export interface AppNotification {
  id: string
  notification_type: string
  title: string
  message: string
  data: Record<string, any> | null
  is_read: boolean
  is_archived: boolean
  created_at: string
  read_at: string | null
}

const normalizeNotification = (notification: any): AppNotification => ({
  id: notification.id,
  notification_type: notification.notification_type,
  title: notification.title,
  message: notification.message,
  data: notification.data || null,
  is_read: Boolean(notification.is_read),
  is_archived: Boolean(notification.is_archived),
  created_at: notification.created_at,
  read_at: notification.read_at || null,
})

export const notificationsApi = {
  getAll: async (params?: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
  }): Promise<{
    notifications: AppNotification[]
    unreadCount: number
    limit: number
    offset: number
  }> => {
    const queryParams = new URLSearchParams()

    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.offset) queryParams.append('offset', String(params.offset))
    if (params?.unreadOnly) queryParams.append('unreadOnly', 'true')

    const queryString = queryParams.toString()
    const response = await apiClient.get(
      `/notifications${queryString ? `?${queryString}` : ''}`,
    )
    const data = response.data.data || response.data

    return {
      notifications: (data.notifications || []).map(normalizeNotification),
      unreadCount: data.unreadCount || 0,
      limit: data.limit || params?.limit || 20,
      offset: data.offset || params?.offset || 0,
    }
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.put(`/notifications/${id}/read`)
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read/all')
  },

  archive: async (id: string): Promise<void> => {
    await apiClient.put(`/notifications/${id}/archive`)
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`)
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
    const collections = Array.isArray(data) ? data : data.collections || []
    const pagination = data.pagination || {
      page: 1,
      limit: 20,
      total: collections.length,
      totalPages: 1,
    }

    return {
      collections,
      pagination,
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

  getBySlug: async (slug: string): Promise<ProductCollection> => {
    return collectionsApi.getById(slug)
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
      products: data.products || data.collection?.products || [],
      pagination: data.pagination || {
        page: 1,
        limit: 20,
        total: (data.products || data.collection?.products || []).length,
        totalPages: 1,
      },
    }
  },
}

// ============================================
// Books API
// ============================================
export const booksApi = {
  getAll: async (filters?: {
    page?: number
    limit?: number
    search?: string
    format?: string
  }): Promise<{ books: Book[]; pagination: Pagination }> => {
    const params = new URLSearchParams()

    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.search) params.set('search', filters.search)
    if (filters?.format) params.set('format', filters.format)

    const query = params.toString()
    const response = await apiClient.get(query ? `/books?${query}` : '/books')
    const data = response.data.data || response.data

    if (Array.isArray(data)) {
      return {
        books: data,
        pagination: {
          page: filters?.page || 1,
          limit: filters?.limit || data.length || 20,
          total: data.length,
          totalPages: 1,
        },
      }
    }

    const books = data.books || data.items || data.data || []

    return {
      books,
      pagination: data.pagination || {
        page: filters?.page || 1,
        limit: filters?.limit || books.length || 20,
        total: books.length,
        totalPages: 1,
      },
    }
  },

  getById: async (id: string): Promise<Book> => {
    const response = await apiClient.get(`/books/${id}`)
    const data = response.data.data || response.data
    return data.book || data
  },

  getSampleAccess: async (id: string): Promise<BookSampleAccess | null> => {
    const response = await apiClient.get(`/books/${id}/sample`)
    const data = response.data.data || response.data

    if (!data) {
      return null
    }

    return data.access || data
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
    const requestId = getRequestIdFromResponse(response)
    const data = response.data.data || response.data
    const source = isRecord(data) ? data.paymentMethods || data : data
    const methods = toSafeArray<unknown>(source)

    if (!Array.isArray(source)) {
      logNormalizationIssue(
        '/payments/methods',
        'Expected payment method array payload',
        data,
        requestId,
      )
    }

    return methods.map((method, index) => {
      if (!isRecord(method)) {
        logNormalizationIssue(
          '/payments/methods',
          'Encountered non-object payment method item',
          method,
          requestId,
        )
      }

      const item = isRecord(method) ? method : {}
      return {
        id: toSafeString(item.id, `pm-${index}`),
        type: toSafeString(item.type, 'card'),
        brand: toSafeString(item.brand),
        last4: toSafeString(item.last4),
        expMonth: toSafeNumber(item.expMonth ?? item.exp_month, 0),
        expYear: toSafeNumber(item.expYear ?? item.exp_year, 0),
        isDefault: toSafeBoolean(item.isDefault ?? item.is_default),
      }
    })
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
    const requestId = getRequestIdFromResponse(response)
    const result = response.data.data || response.data
    const rawOrder = isRecord(result) ? result.order || result : result

    if (!isRecord(rawOrder)) {
      logNormalizationIssue(
        '/orders',
        'Unexpected order create payload',
        rawOrder,
        requestId,
      )
      return {
        id: '',
        order_number: '',
        order_status: 'pending',
        payment_status: 'pending',
        grand_total: 0,
        shipping_address: {},
        items: [],
        created_at: new Date().toISOString(),
      }
    }

    const rawItems =
      rawOrder.items || rawOrder.order_items || rawOrder.orderItems || []
    const normalizedItems = toSafeArray<unknown>(rawItems).map(
      (item, index) => {
        const line = isRecord(item) ? item : {}
        const quantity = toSafeNumber(line.quantity, 0)
        const unitPrice = toSafeNumber(line.unit_price ?? line.unitPrice, 0)
        const nestedProductName = isRecord(line.product)
          ? toSafeString(line.product.name)
          : ''
        return {
          id: toSafeString(line.id, `${toSafeString(rawOrder.id)}-${index}`),
          product_name:
            toSafeString(line.product_name ?? line.productName) ||
            nestedProductName ||
            'Product',
          quantity,
          unit_price: unitPrice,
          total_price:
            toSafeNumber(line.total_price ?? line.totalPrice, 0) ||
            quantity * unitPrice,
        }
      },
    )

    return {
      id: toSafeString(rawOrder.id),
      order_number: toSafeString(rawOrder.order_number),
      order_status: toSafeString(rawOrder.order_status, 'pending'),
      payment_status: toSafeString(rawOrder.payment_status, 'pending'),
      grand_total: toSafeNumber(rawOrder.grand_total),
      shipping_address: isRecord(rawOrder.shipping_address)
        ? rawOrder.shipping_address
        : {},
      items: normalizedItems,
      created_at: toSafeString(rawOrder.created_at) || new Date().toISOString(),
    }
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
    const requestId = getRequestIdFromResponse(response)
    const data = response.data.data || response.data
    const ordersSource = isRecord(data) ? data.orders || data : data
    const normalizedOrders = toSafeArray<unknown>(ordersSource).map(
      (order, index) => {
        const item = isRecord(order) ? order : {}
        return {
          id: toSafeString(item.id, `order-${index}`),
          order_number: toSafeString(item.order_number),
          order_status: toSafeString(item.order_status, 'pending'),
          payment_status: toSafeString(item.payment_status, 'pending'),
          grand_total: toSafeNumber(item.grand_total),
          created_at: toSafeString(item.created_at) || new Date().toISOString(),
          item_count: toSafeNumber(item.item_count ?? item.itemCount, 0),
        }
      },
    )

    if (!Array.isArray(ordersSource)) {
      logNormalizationIssue(
        '/orders',
        'Expected order list array payload',
        data,
        requestId,
      )
    }

    return {
      orders: normalizedOrders,
      pagination: (isRecord(data) && isRecord(data.pagination)
        ? {
            page: toSafeNumber(data.pagination.page, 1),
            limit: toSafeNumber(data.pagination.limit, limit),
            total: toSafeNumber(data.pagination.total, normalizedOrders.length),
            totalPages: toSafeNumber(data.pagination.totalPages, 1),
          }
        : {
            page: 1,
            limit,
            total: normalizedOrders.length,
            totalPages: 1,
          }) as Pagination,
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
    const requestId = getRequestIdFromResponse(response)
    const data = response.data.data || response.data
    const rawOrder = isRecord(data) ? data.order || data : data

    if (!isRecord(rawOrder)) {
      logNormalizationIssue(
        '/orders/:id',
        'Unexpected order detail payload',
        rawOrder,
        requestId,
      )
      return {
        id,
        order_number: '',
        order_status: 'pending',
        payment_status: 'pending',
        total_amount: 0,
        tax_amount: 0,
        shipping_amount: 0,
        grand_total: 0,
        shipping_address: {},
        items: [],
        created_at: new Date().toISOString(),
      }
    }

    const rawItems =
      rawOrder?.items || rawOrder?.order_items || rawOrder?.orderItems || []

    const normalizedItems = Array.isArray(rawItems)
      ? rawItems.map((item: any, index: number) => ({
          id: String(item?.id ?? `${id}-item-${index}`),
          product_id: String(item?.product_id ?? item?.productId ?? ''),
          product_name:
            item?.product_name ||
            item?.productName ||
            item?.product?.name ||
            'Product',
          quantity: Number(item?.quantity ?? 0),
          unit_price: Number(item?.unit_price ?? item?.unitPrice ?? 0),
          total_price:
            Number(item?.total_price ?? item?.totalPrice) ||
            Number(item?.unit_price ?? item?.unitPrice ?? 0) *
              Number(item?.quantity ?? 0),
        }))
      : []

    return {
      ...rawOrder,
      id: toSafeString(rawOrder.id, id),
      order_number: toSafeString(rawOrder.order_number),
      order_status: toSafeString(rawOrder.order_status, 'pending'),
      payment_status: toSafeString(rawOrder.payment_status, 'pending'),
      total_amount: toSafeNumber(rawOrder.total_amount),
      tax_amount: toSafeNumber(rawOrder.tax_amount),
      shipping_amount: toSafeNumber(rawOrder.shipping_amount),
      grand_total: toSafeNumber(rawOrder.grand_total),
      shipping_address: isRecord(rawOrder.shipping_address)
        ? rawOrder.shipping_address
        : {},
      created_at: toSafeString(rawOrder.created_at) || new Date().toISOString(),
      items: normalizedItems,
    }
  },

  // Cancel order
  cancel: async (id: string, reason?: string): Promise<object> => {
    const response = await apiClient.put(`/orders/${id}/cancel`, { reason })
    const data = response.data.data || response.data
    return data.order || data
  },

  // Create the order (pending payment) + Stripe PaymentIntent together,
  // BEFORE payment is confirmed -- mirrors the web storefront's
  // checkout-session flow (POST /orders/checkout-session). The order always
  // exists before any money can be captured, unlike the old create() above
  // (still used nowhere now, kept only for reference/backward compat).
  checkoutSession: async (data: {
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
    customerNotes?: string
  }): Promise<{
    clientSecret: string
    paymentIntentId: string
    orderId: string
    orderNumber: string
    currency: string
    taxAmount: number
    shippingAmount: number
    grandTotal: number
  }> => {
    const response = await apiClient.post('/orders/checkout-session', data)
    const requestId = getRequestIdFromResponse(response)
    const result = response.data.data || response.data

    if (!isRecord(result)) {
      logNormalizationIssue(
        '/orders/checkout-session',
        'Unexpected checkout-session payload',
        result,
        requestId,
      )
      throw new Error('Failed to start checkout')
    }

    return {
      clientSecret: toSafeString(result.clientSecret),
      paymentIntentId: toSafeString(result.paymentIntentId),
      orderId: toSafeString(result.orderId),
      orderNumber: toSafeString(result.orderNumber),
      currency: toSafeString(result.currency, 'EUR'),
      taxAmount: toSafeNumber(result.taxAmount),
      shippingAmount: toSafeNumber(result.shippingAmount),
      grandTotal: toSafeNumber(result.grandTotal),
    }
  },
}

// Combined API object for convenience
export const api = {
  auth: authApi,
  user: userApi,
  contact: contactApi,
  products: productsApi,
  categories: categoriesApi,
  brands: brandsApi,
  orders: ordersApi,
  ordersNew: ordersApiNew,
  addresses: addressesApi,
  notifications: notificationsApi,
  reviews: reviewsApi,
  wishlist: wishlistApi,
  blog: blogApi,
  collections: collectionsApi,
  trending: trendingApi,
  payments: paymentsApi,
}

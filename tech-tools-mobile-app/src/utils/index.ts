// ============================================
// TechTools Mobile App - Utilities
// ============================================

import { Product, ProductMedia } from '../types'

// Image base URL
const IMAGE_BASE_URL = 'https://techtoolstore.com'

/**
 * Format price with currency symbol
 */
export const formatPrice = (
  price: number | string | null | undefined,
): string => {
  if (price === null || price === undefined) return '$0.00'
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(numPrice)) return '$0.00'
  return `$${numPrice.toFixed(2)}`
}

/**
 * Calculate discount percentage
 */
export const calculateDiscount = (
  originalPrice: number | string,
  salePrice: number | string,
): number => {
  const original =
    typeof originalPrice === 'string'
      ? parseFloat(originalPrice)
      : originalPrice
  const sale = typeof salePrice === 'string' ? parseFloat(salePrice) : salePrice

  if (isNaN(original) || isNaN(sale) || original <= 0) return 0
  return Math.round(((original - sale) / original) * 100)
}

/**
 * Get product primary image URL
 */
export const getProductImage = (
  product: {
    images?: { url: string; is_primary?: boolean }[] | null
    media?: { url: string; is_primary?: boolean }[] | null
  } | null,
): string => {
  if (!product) return getPlaceholderImage()

  const images = product.images || product.media || []
  if (!images || images.length === 0) return getPlaceholderImage()

  const primaryImage = images.find((img) => img.is_primary)
  const imageUrl = primaryImage?.url || images[0]?.url

  if (!imageUrl) return getPlaceholderImage()

  // Handle relative URLs
  if (imageUrl.startsWith('/')) {
    return `${IMAGE_BASE_URL}${imageUrl}`
  }

  return imageUrl
}

/**
 * Get all product images
 */
export const getProductImages = (product: Product): string[] => {
  const images = product.images || product.media || []
  if (!images || images.length === 0) return [getPlaceholderImage()]

  return images.map((img) => {
    if (img.url.startsWith('/')) {
      return `${IMAGE_BASE_URL}${img.url}`
    }
    return img.url
  })
}

/**
 * Get all product media (images and videos) with full URLs
 */
export const getProductMedia = (product: Product): ProductMedia[] => {
  // Prefer media array which contains both images and videos
  const mediaItems = product.media || product.images || []
  if (!mediaItems || mediaItems.length === 0) {
    return [{
      id: 'placeholder',
      url: getPlaceholderImage(),
      alt_text: product.name || 'Product',
      is_primary: true,
      position: 0,
      type: 'image',
    }]
  }

  return mediaItems
    .map((item) => ({
      ...item,
      type: (item.type || 'image') as 'image' | 'video',
      url: item.url.startsWith('/') ? `${IMAGE_BASE_URL}${item.url}` : item.url,
    }))
    .sort((a, b) => {
      // Primary items first, then by position
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return (a.position || 0) - (b.position || 0)
    })
}

/**
 * Get placeholder image
 */
export const getPlaceholderImage = (): string => {
  return 'https://via.placeholder.com/400x400?text=No+Image'
}

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text || ''
  return `${text.slice(0, maxLength)}...`
}

/**
 * Format date
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    return formatDate(dateString)
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  } else {
    return 'Just now'
  }
}

/**
 * Generate star rating array
 */
export const generateStarRating = (
  rating: number | string,
): ('full' | 'half' | 'empty')[] => {
  const numRating = typeof rating === 'string' ? parseFloat(rating) : rating
  const stars: ('full' | 'half' | 'empty')[] = []

  for (let i = 1; i <= 5; i++) {
    if (numRating >= i) {
      stars.push('full')
    } else if (numRating >= i - 0.5) {
      stars.push('half')
    } else {
      stars.push('empty')
    }
  }

  return stars
}

/**
 * Format countdown time
 */
export const formatCountdown = (
  endTime: Date | string | null | undefined,
): { hours: number; minutes: number; seconds: number } => {
  if (!endTime) {
    return { hours: 0, minutes: 0, seconds: 0 }
  }

  const target = endTime instanceof Date ? endTime : new Date(endTime)
  if (Number.isNaN(target.getTime())) {
    return { hours: 0, minutes: 0, seconds: 0 }
  }

  const now = new Date()
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0 }
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { hours, minutes, seconds }
}

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export const validatePassword = (
  password: string,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Get order status color
 */
export const getOrderStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: '#FFA500',
    confirmed: '#3B82F6',
    processing: '#8B5CF6',
    shipped: '#06B6D4',
    delivered: '#10B981',
    cancelled: '#EF4444',
    refunded: '#6B7280',
  }

  return colors[status] || '#6B7280'
}

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

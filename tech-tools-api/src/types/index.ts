// Type definitions for TechTools API

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  userType: 'customer' | 'supplier' | 'admin' | 'super_admin'
  companyName?: string
  emailVerified: boolean
  phoneVerified: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: string
  sku: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  brandId?: string
  categoryId: string
  basePrice: number
  salePrice?: number
  costPrice?: number
  taxRate: number
  weight?: number
  weightUnit: string
  isActive: boolean
  isDigital: boolean
  isFeatured: boolean
  isBackorderAllowed: boolean
  minOrderQuantity: number
  maxOrderQuantity?: number
  metaTitle?: string
  metaDescription?: string
  createdAt: Date
  updatedAt: Date
}

export interface ProductVariation {
  id: string
  productId: string
  sku: string
  variationName?: string
  attributes: Record<string, any>
  imageUrls: string[]
  priceAdjustment: number
  stockQuantity: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  parentId?: string
  imageUrl?: string
  metaTitle?: string
  metaDescription?: string
  isActive: boolean
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  id: string
  orderNumber: string
  userId: string
  orderStatus:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
  paymentStatus:
    | 'pending'
    | 'authorized'
    | 'paid'
    | 'partially_refunded'
    | 'refunded'
    | 'failed'
    | 'cancelled'
  totalAmount: number
  taxAmount: number
  shippingAmount: number
  discountAmount: number
  grandTotal: number
  currency: string
  shippingAddress: Record<string, any>
  billingAddress?: Record<string, any>
  customerNotes?: string
  internalNotes?: string
  paymentMethod?: string
  paymentGateway?: string
  transactionId?: string
  estimatedDeliveryDate?: Date
  actualDeliveryDate?: Date
  cancelledAt?: Date
  cancelledReason?: string
  createdAt: Date
  updatedAt: Date
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  variationId?: string
  supplierId?: string
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountAmount: number
  totalPrice: number
  itemStatus: 'pending' | 'allocated' | 'shipped' | 'delivered' | 'cancelled'
  trackingNumber?: string
  carrier?: string
  shippedAt?: Date
  deliveredAt?: Date
  createdAt: Date
}

export interface Supplier {
  id: string
  userId: string
  companyName: string
  contactName?: string
  email: string
  phone?: string
  taxId?: string
  address: Record<string, any>
  paymentTerms?: string
  leadTimeDays: number
  reliabilityScore: number
  isActive: boolean
  apiEndpoint?: string
  apiKey?: string
  syncFrequency: 'hourly' | 'daily' | 'weekly'
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// Auto-generated from PostgreSQL database schema
// Generated on: 2026-02-10T21:25:33.021Z
// DO NOT EDIT MANUALLY - Run npm run generate:types to regenerate

export interface AdminActivityLogs {
  // Default: gen_random_uuid()
  id?: string
  adminId: string
  action: string
  resourceType: string
  resourceId?: string
  ipAddress?: any
  userAgent?: string
  details?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface AdminInvitations {
  // Default: gen_random_uuid()
  id?: string
  email: string
  role: string
  token: string
  invitedBy: string
  expiresAt: string
  acceptedAt?: string
  // Default: false
  isUsed?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface AdminPermissions {
  // Default: gen_random_uuid()
  id?: string
  name: string
  description?: string
  resource: string
  actions: string[]
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface AdminRolePermissions {
  // Default: gen_random_uuid()
  id?: string
  role: string
  permissionId: string
  grantedBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface AdminSessions {
  // Default: gen_random_uuid()
  id?: string
  adminId: string
  tokenHash: string
  ipAddress?: any
  userAgent?: string
  // Default: CURRENT_TIMESTAMP
  lastActivity?: string
  expiresAt: string
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface AdminTwoFactor {
  // Default: gen_random_uuid()
  id?: string
  adminId: string
  secret: string
  backupCodes?: string[]
  // Default: false
  isEnabled?: boolean
  enabledAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Brands {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  slug: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface Cart {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  sessionId?: string
  expiresAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface CartItems {
  // Default: uuid_generate_v4()
  id?: string
  cartId?: string
  productId?: string
  variationId?: string
  // Default: 1
  quantity?: number
  unitPrice: number
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Categories {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  slug: string
  description?: string
  parentId?: string
  imageUrl?: string
  metaTitle?: string
  metaDescription?: string
  // Default: true
  isActive?: boolean
  // Default: 0
  displayOrder?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface CategoryCollectionItems {
  // Default: gen_random_uuid()
  id?: string
  collectionId: string
  categoryId: string
  // Default: 0
  position?: number
  // Default: false
  isFeatured?: boolean
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
  addedBy?: string
}

export interface CategoryCollections {
  // Default: gen_random_uuid()
  id?: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  imageUrl?: string
  bannerUrl?: string
  // Default: true
  isActive?: boolean
  // Default: false
  isFeatured?: boolean
  // Default: 'public'::character varying
  visibility?: string
  // Default: 0
  position?: number
  // Default: 'manual'::character varying
  displayOrder?: string
  // Default: 0
  itemsCount?: number
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  startsAt?: string
  endsAt?: string
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface CategoryMedia {
  // Default: gen_random_uuid()
  id?: string
  categoryId: string
  type: string
  mediaPurpose: string
  url: string
  thumbnailUrl?: string
  altText?: string
  title?: string
  // Default: 0
  position?: number
  fileSize?: number
  width?: number
  height?: number
  format?: string
  duration?: number
  // Default: '{}'::jsonb
  cdnUrls?: {
    original?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
  }
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Inventory {
  // Default: uuid_generate_v4()
  id?: string
  productId?: string
  variationId?: string
  warehouseLocation?: string
  // Default: 0
  currentStock?: number
  // Default: 0
  reservedStock?: number
  availableStock?: number
  // Default: 10
  lowStockThreshold?: number
  reorderQuantity?: number
  lastRestocked?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface OrderItems {
  // Default: uuid_generate_v4()
  id?: string
  orderId?: string
  productId?: string
  variationId?: string
  supplierId?: string
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  // Default: 0
  taxRate?: number
  // Default: 0
  discountAmount?: number
  totalPrice?: number
  // Default: 'pending'::character varying
  itemStatus?: string
  trackingNumber?: string
  carrier?: string
  shippedAt?: string
  deliveredAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface Orders {
  // Default: uuid_generate_v4()
  id?: string
  orderNumber: string
  userId?: string
  // Default: 'pending'::character varying
  orderStatus?: string
  // Default: 'pending'::character varying
  paymentStatus?: string
  totalAmount: number
  // Default: 0
  taxAmount?: number
  // Default: 0
  shippingAmount?: number
  // Default: 0
  discountAmount?: number
  grandTotal: number
  // Default: 'USD'::character varying
  currency?: string
  shippingAddress: any
  billingAddress?: any
  customerNotes?: string
  internalNotes?: string
  paymentMethod?: string
  paymentGateway?: string
  transactionId?: string
  estimatedDeliveryDate?: string
  actualDeliveryDate?: string
  cancelledAt?: string
  cancelledReason?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Payments {
  // Default: uuid_generate_v4()
  id?: string
  orderId?: string
  paymentMethod: string
  paymentGateway: string
  transactionId?: string
  amount: number
  // Default: 'USD'::character varying
  currency?: string
  // Default: 'pending'::character varying
  status?: string
  gatewayResponse?: any
  // Default: 0
  refundAmount?: number
  refundReason?: string
  paidAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ProductCollectionItems {
  // Default: gen_random_uuid()
  id?: string
  collectionId: string
  productId: string
  // Default: 0
  position?: number
  // Default: false
  isFeatured?: boolean
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
  addedBy?: string
}

export interface ProductCollections {
  // Default: gen_random_uuid()
  id?: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  imageUrl?: string
  bannerUrl?: string
  // Default: true
  isActive?: boolean
  // Default: false
  isFeatured?: boolean
  // Default: 'public'::character varying
  visibility?: string
  // Default: 0
  position?: number
  // Default: 'manual'::character varying
  displayOrder?: string
  // Default: 0
  itemsCount?: number
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  startsAt?: string
  endsAt?: string
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ProductImages {
  // Default: uuid_generate_v4()
  id?: string
  productId?: string
  variationId?: string
  imageUrl: string
  altText?: string
  // Default: false
  isPrimary?: boolean
  // Default: 0
  displayOrder?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface ProductMedia {
  // Default: gen_random_uuid()
  id?: string
  productId: string
  type: string
  url: string
  thumbnailUrl?: string
  altText?: string
  title?: string
  // Default: 0
  position?: number
  // Default: false
  isPrimary?: boolean
  fileSize?: number
  width?: number
  height?: number
  format?: string
  duration?: number
  // Default: '{}'::jsonb
  cdnUrls?: {
    original?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
  }
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ProductSpecifications {
  // Default: uuid_generate_v4()
  id?: string
  productId?: string
  specKey: string
  specValue: string
  specGroup?: string
  // Default: 0
  displayOrder?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface ProductVariations {
  // Default: uuid_generate_v4()
  id?: string
  productId?: string
  sku: string
  variationName?: string
  attributes?: any
  imageUrls?: string[]
  // Default: 0
  priceAdjustment?: number
  // Default: 0
  stockQuantity?: number
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Products {
  // Default: uuid_generate_v4()
  id?: string
  sku: string
  name: string
  slug: string
  description?: string
  shortDescription?: string
  brandId?: string
  categoryId?: string
  basePrice: number
  salePrice?: number
  costPrice?: number
  // Default: 0
  taxRate?: number
  weight?: number
  // Default: 'kg'::character varying
  weightUnit?: string
  length?: number
  width?: number
  height?: number
  // Default: 'cm'::character varying
  dimensionsUnit?: string
  // Default: true
  isActive?: boolean
  // Default: false
  isDigital?: boolean
  // Default: false
  isFeatured?: boolean
  // Default: false
  isBackorderAllowed?: boolean
  // Default: 1
  minOrderQuantity?: number
  maxOrderQuantity?: number
  metaTitle?: string
  metaDescription?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  deletedAt?: string
}

export interface Reviews {
  // Default: uuid_generate_v4()
  id?: string
  productId?: string
  userId?: string
  orderItemId?: string
  rating: number
  title?: string
  comment?: string
  // Default: false
  isVerifiedPurchase?: boolean
  // Default: true
  isApproved?: boolean
  // Default: 0
  helpfulCount?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface SupplierProducts {
  // Default: uuid_generate_v4()
  id?: string
  supplierId?: string
  productId?: string
  supplierProductId?: string
  supplierSku?: string
  costPrice: number
  // Default: 0
  stockQuantity?: number
  // Default: 1
  minOrderQuantity?: number
  // Default: 0
  shippingCost?: number
  estimatedDeliveryDays?: number
  // Default: true
  isAvailable?: boolean
  // Default: CURRENT_TIMESTAMP
  lastUpdated?: string
}

export interface Suppliers {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  companyName: string
  contactName?: string
  email: string
  phone?: string
  taxId?: string
  address?: any
  paymentTerms?: string
  // Default: 7
  leadTimeDays?: number
  // Default: 5.0
  reliabilityScore?: number
  // Default: true
  isActive?: boolean
  apiEndpoint?: string
  apiKey?: string
  // Default: 'daily'::character varying
  syncFrequency?: string
  lastSyncAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface UserAddresses {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  // Default: 'shipping'::character varying
  addressType?: string
  fullName?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state?: string
  country: string
  postalCode: string
  phone?: string
  // Default: false
  isDefault?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Users {
  // Default: uuid_generate_v4()
  id?: string
  email: string
  phone?: string
  passwordHash: string
  firstName?: string
  lastName?: string
  // Default: 'customer'::character varying
  userType?: string
  companyName?: string
  taxId?: string
  businessType?: string
  // Default: false
  emailVerified?: boolean
  // Default: false
  phoneVerified?: boolean
  // Default: true
  isActive?: boolean
  lastLogin?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  deletedAt?: string
  lastLoginAt?: string
  lastLoginIp?: any
  // Default: 0
  failedLoginAttempts?: number
  lockedUntil?: string
  // Default: false
  twoFactorEnabled?: boolean
}

export interface Wishlist {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  productId?: string
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: {
    items: T[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

export interface AuthResponse {
  success: boolean
  data: {
    user: Users
    tokens: {
      accessToken: string
      refreshToken: string
    }
  }
}

// Auto-generated from PostgreSQL database schema
// Generated on: 2026-09-20T19:24:47.990Z
// DO NOT EDIT MANUALLY - Run npm run generate:types to regenerate

// ---- Enum types (from pg_enum, real values, not guessed) ----

export type AffiliateConversionStatus = 'pending' | 'confirmed' | 'cancelled' | 'paid'
export type AffiliateProfileStatus = 'active' | 'suspended'
export type AiActionType = 'draft_generated' | 'draft_approved' | 'draft_rejected' | 'draft_sent' | 'draft_failed' | 'customer_analyzed' | 'campaign_generated' | 'timeline_viewed'
export type AiChannel = 'email' | 'whatsapp' | 'newsletter' | 'contact_reply'
export type AiDraftStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'failed'
export type AlertSeverityEnum = 'critical' | 'high' | 'medium' | 'low'
export type ChannelFinancialTransactionType = 'SETTLEMENT' | 'COMMISSION' | 'AD_SPEND' | 'REFUND' | 'AFFILIATE_COMMISSION'
export type ChannelInventoryDiffAction = 'NONE' | 'FLAGGED' | 'WRITTEN_TO_CHANNEL'
export type ChannelProductMappingStatus = 'UNMAPPED' | 'MAPPED' | 'CONFLICT' | 'CHANNEL_ONLY'
export type CommerceChannelAccountStatus = 'DISCONNECTED' | 'CONNECTED' | 'TOKEN_EXPIRED' | 'NEEDS_CREDENTIALS' | 'APP_REVIEW_REQUIRED' | 'DISABLED_BY_ADMIN' | 'ERROR'
export type CouponStatus = 'active' | 'inactive' | 'expired' | 'scheduled'
export type CouponType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y'
export type DeviceTypeEnum = 'desktop' | 'tablet' | 'mobile' | 'unknown'
export type EventSourceEnum = 'web_store' | 'mobile_app' | 'api' | 'admin_dashboard' | 'internal'
export type EventTypeEnum = 'product_view' | 'search' | 'add_to_cart' | 'remove_from_cart' | 'checkout_start' | 'payment_success' | 'order_created' | 'refund_created' | 'return_requested' | 'support_ticket_created' | 'product_favorite' | 'category_view' | 'filter_applied' | 'sort_applied' | 'checkout_abandoned' | 'promo_code_applied' | 'review_submitted' | 'supplier_interaction' | 'page_view' | 'error' | 'discover_view' | 'discover_watch_complete' | 'discover_replay' | 'discover_product_card_open' | 'discover_skip'
export type PromotionCampaignStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PARTIAL_SUCCESS' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'DRY_RUN_COMPLETED'
export type PromotionChannelPostStatus = 'DRAFT' | 'QUEUED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'DRY_RUN_SUCCEEDED' | 'REQUIRES_ACTION'
export type SellerAccountStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'REJECTED' | 'CLOSED'
export type SellerApplicantType = 'individual' | 'registered_business'
export type SellerDocumentCategory = 'identity_document' | 'proof_of_address' | 'business_registration' | 'tax_document' | 'additional_requested'
export type SellerDocumentReviewStatus = 'pending' | 'accepted' | 'rejected'
export type SellerDocumentScanStatus = 'not_scanned' | 'clean' | 'flagged' | 'error'
export type SellerEarningStatus = 'pending' | 'confirmed' | 'cancelled' | 'paid'
export type SellerOnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED'
export type SellerProfileVerificationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'MORE_INFORMATION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type SellerStoreStatus = 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'SUSPENDED' | 'CLOSED'
export type SellerTier = 'unverified' | 'basic' | 'trusted' | 'pro'
export type SellerVerificationCaseStatus = 'PENDING' | 'MORE_INFORMATION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED'
export type SellerVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'suspended'
export type SocialConnectionStatus = 'DISCONNECTED' | 'CONNECTED' | 'TOKEN_EXPIRED' | 'NEEDS_CREDENTIALS' | 'MISSING_PERMISSION' | 'APP_REVIEW_REQUIRED' | 'DISABLED_BY_ADMIN' | 'ERROR'
export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'LINKEDIN' | 'PINTEREST' | 'X'
export type StaffMembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
export type StaffRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'MARKET_MANAGER' | 'CATALOG_MANAGER' | 'ORDER_MANAGER' | 'MARKETING_MANAGER' | 'SUPPORT_AGENT'

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

export interface AdminBookIdempotency {
  // Default: uuid_generate_v4()
  id?: string
  adminId: string
  action: string
  idempotencyKey: string
  resourceId?: string
  responsePayload?: any
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

export interface AdminNotificationPreferences {
  // Default: gen_random_uuid()
  id?: string
  adminId: string
  // Default: true
  emailEnabled?: boolean
  emailAddress?: string
  // Default: false
  slackEnabled?: boolean
  slackChannel?: string
  // Default: false
  smsEnabled?: boolean
  phoneNumber?: string
  // Default: 'high'::character varying
  severityThreshold?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface AdminNotifications {
  // Default: gen_random_uuid()
  id?: string
  adminId: string
  notificationType: string
  title: string
  message: string
  // Default: '{}'::jsonb
  data?: any
  // Default: 'normal'::character varying
  priority?: string
  // Default: false
  isRead?: boolean
  // Default: false
  isArchived?: boolean
  readAt?: string
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

export interface AffiliateClicks {
  // Default: uuid_generate_v4()
  id?: string
  affiliateId: string
  referralCode: string
  visitorId?: string
  landingPath?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface AffiliateConversions {
  // Default: uuid_generate_v4()
  id?: string
  affiliateId: string
  orderId: string
  orderValue: number
  commissionRateSnapshot: number
  commissionAmount: number
  // Default: 'pending'::affiliate_conversion_status
  status?: AffiliateConversionStatus
  cancelledReason?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  confirmedAt?: string
  cancelledAt?: string
}

export interface AffiliateProfiles {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  referralCode: string
  // Default: 'active'::affiliate_profile_status
  status?: AffiliateProfileStatus
  // Default: 0
  totalClicks?: number
  // Default: 0
  totalConversions?: number
  // Default: 0
  totalEarned?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface AffiliateSettings {
  // Default: 1
  id?: number
  // Default: 10.00
  commissionRatePercent?: number
  // Default: 14
  holdPeriodDays?: number
  // Default: 30
  fallbackHoldPeriodDays?: number
  // Default: 0
  minPayoutAmount?: number
  // Default: true
  programEnabled?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface AiAuditLog {
  // Default: gen_random_uuid()
  id?: string
  action: AiActionType
  actorId: string
  draftId?: string
  channel?: AiChannel
  customerId?: string
  // Default: '{}'::jsonb
  meta?: any
  ipAddress?: any
  userAgent?: string
  // Default: now()
  createdAt?: string
}

export interface AiDrafts {
  // Default: gen_random_uuid()
  id?: string
  channel: AiChannel
  // Default: 'pending'::ai_draft_status
  status?: AiDraftStatus
  recipientEmail?: string
  recipientPhone?: string
  recipientName?: string
  customerId?: string
  contactId?: string
  subject?: string
  bodyHtml?: string
  bodyText: string
  prompt: string
  modelName: string
  modelVersion?: string
  // Default: '{}'::jsonb
  tokenUsage?: any
  confidence?: number
  createdBy: string
  approvedBy?: string
  rejectedBy?: string
  sentAt?: string
  rejectReason?: string
  scheduledAt?: string
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
}

export interface AlertThresholds {
  // Default: gen_random_uuid()
  id?: string
  thresholdType: string
  thresholdValue: number
  baselineValue?: number
  unit: string
  // Default: 'high'::character varying
  severity?: string
  // Default: true
  isActive?: boolean
  description?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Alerts {
  // Default: gen_random_uuid()
  id?: string
  alertType: string
  // Default: 'medium'::alert_severity_enum
  severity?: AlertSeverityEnum
  title: string
  message?: string
  currentValue?: number
  thresholdValue?: number
  baselineValue?: number
  resourceType?: string
  resourceId?: string
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  triggeredAt?: string
  acknowledgedAt?: string
  resolvedAt?: string
  acknowledgedBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface BlogAuthors {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  displayName: string
  slug: string
  bio?: string
  avatarUrl?: string
  websiteUrl?: string
  twitterHandle?: string
  linkedinUrl?: string
  // Default: 'author'::character varying
  role?: string
  // Default: true
  isActive?: boolean
  // Default: 0
  postCount?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface BlogCategories {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  slug: string
  description?: string
  imageUrl?: string
  parentId?: string
  metaTitle?: string
  metaDescription?: string
  // Default: true
  isActive?: boolean
  // Default: 0
  displayOrder?: number
  // Default: 0
  postCount?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface BlogCommentLikes {
  commentId: string
  userId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface BlogComments {
  // Default: uuid_generate_v4()
  id?: string
  postId?: string
  parentId?: string
  userId?: string
  authorName?: string
  authorEmail?: string
  authorWebsite?: string
  authorIp?: string
  content: string
  contentHtml?: string
  // Default: 'pending'::character varying
  status?: string
  // Default: 0
  likeCount?: number
  // Default: false
  isPinned?: boolean
  // Default: false
  isAuthorReply?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface BlogPostLikes {
  postId: string
  userId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface BlogPostMedia {
  // Default: uuid_generate_v4()
  id?: string
  postId?: string
  mediaType: string
  url: string
  thumbnailUrl?: string
  title?: string
  altText?: string
  caption?: string
  description?: string
  videoProvider?: string
  videoId?: string
  durationSeconds?: number
  embedCode?: string
  embedProvider?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  width?: number
  height?: number
  // Default: 0
  displayOrder?: number
  // Default: false
  isFeatured?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface BlogPostTags {
  postId: string
  tagId: string
}

export interface BlogPostViews {
  // Default: uuid_generate_v4()
  id?: string
  postId?: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  referrer?: string
  country?: string
  city?: string
  // Default: CURRENT_TIMESTAMP
  viewedAt?: string
}

export interface BlogPosts {
  // Default: uuid_generate_v4()
  id?: string
  title: string
  slug: string
  excerpt?: string
  content: string
  contentHtml?: string
  featuredImageUrl?: string
  featuredImageAlt?: string
  featuredVideoUrl?: string
  featuredVideoType?: string
  authorId?: string
  categoryId?: string
  // Default: 'draft'::character varying
  status?: string
  // Default: 'public'::character varying
  visibility?: string
  password?: string
  publishedAt?: string
  scheduledAt?: string
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string
  canonicalUrl?: string
  ogTitle?: string
  ogDescription?: string
  ogImageUrl?: string
  // Default: 0
  readingTimeMinutes?: number
  // Default: 0
  wordCount?: number
  // Default: 0
  viewCount?: number
  // Default: 0
  likeCount?: number
  // Default: 0
  commentCount?: number
  // Default: 0
  shareCount?: number
  // Default: true
  allowComments?: boolean
  // Default: false
  isFeatured?: boolean
  // Default: false
  isPinned?: boolean
  createdBy?: string
  updatedBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  deletedAt?: string
}

export interface BlogRelatedPosts {
  postId: string
  relatedPostId: string
  // Default: 'related'::character varying
  relationType?: string
  // Default: 0
  displayOrder?: number
}

export interface BlogSeries {
  // Default: uuid_generate_v4()
  id?: string
  title: string
  slug: string
  description?: string
  coverImageUrl?: string
  authorId?: string
  // Default: 'active'::character varying
  status?: string
  // Default: 0
  postCount?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface BlogSeriesPosts {
  seriesId: string
  postId: string
  partNumber: number
}

export interface BlogTags {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  slug: string
  description?: string
  // Default: 0
  postCount?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface BookMetadata {
  // Default: uuid_generate_v4()
  id?: string
  productId: string
  // Default: 'pdf'::character varying
  format?: string
  fileUrl?: string
  previewUrl?: string
  coverImageUrl?: string
  // Default: 'en'::character varying
  languageCode?: string
  pageCount?: number
  isbn?: string
  publisherName?: string
  publicationDate?: string
  // Default: false
  drmEnabled?: boolean
  // Default: '{}'::jsonb
  metadata?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface BrandFollows {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  brandId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
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
  // Default: false
  isFeatured?: boolean
  trendingPosition?: number
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
  // Default: false
  showInNav?: boolean
}

export interface CategoryAttributes {
  // Default: uuid_generate_v4()
  id?: string
  categoryId: string
  name: string
  inputType: string
  options?: string[]
  unit?: string
  // Default: 0
  displayOrder?: number
  // Default: true
  isFilterable?: boolean
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
  mediaType: string
  mediaPurpose: string
  filePath: string
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
  mimeType?: string
  description?: string
  videoDuration?: number
}

export interface ChannelActivityLog {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId: string
  syncRunId?: string
  actorUserId?: string
  action: string
  // Default: '{}'::jsonb
  metadata?: any
  // Default: now()
  createdAt?: string
}

export interface ChannelFinancialTransactions {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId: string
  channelOrderId?: string
  transactionType: ChannelFinancialTransactionType
  amount: number
  currency: string
  channelTransactionId: string
  occurredAt?: string
  rawPayload: any
  // Default: now()
  syncedAt?: string
}

export interface ChannelInventoryDiffs {
  // Default: gen_random_uuid()
  id?: string
  runId: string
  channelProductMappingId: string
  techtoolsAvailableStock?: number
  channelReportedStock?: number
  delta?: number
  // Default: 'NONE'::channel_inventory_diff_action
  actionTaken?: ChannelInventoryDiffAction
  // Default: now()
  createdAt?: string
}

export interface ChannelOrderImportIssues {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId: string
  syncRunId?: string
  externalOrderId: string
  externalUpdatedAt?: string
  reasonCode: string
  reasonDetail?: string
  // Default: now()
  discoveredAt?: string
  resolvedAt?: string
  resolvedBy?: string
  resolutionNote?: string
  // Default: now()
  createdAt?: string
}

export interface ChannelOrderItems {
  // Default: gen_random_uuid()
  id?: string
  channelOrderId: string
  channelProductMappingId?: string
  channelSku?: string
  quantity: number
  unitPrice: number
  lineTotal: number
  rawPayload: any
  // Default: now()
  createdAt?: string
}

export interface ChannelOrders {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId: string
  techtoolsOrderId?: string
  channelOrderId: string
  channelOrderStatus: string
  buyerDisplayName?: string
  buyerCountry?: string
  currency: string
  grossAmount: number
  platformCommissionAmount?: number
  shippingFeeAmount?: number
  taxAmount?: number
  netAmount?: number
  rawPayload: any
  // Default: now()
  importedAt?: string
  lastSyncedAt?: string
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
  externalUpdatedAt?: string
}

export interface ChannelProductMappings {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId: string
  productId?: string
  channelProductId: string
  channelSku?: string
  channelVariationId?: string
  // Default: 'UNMAPPED'::channel_product_mapping_status
  mappingStatus?: ChannelProductMappingStatus
  lastSyncedAt?: string
  lastDiff?: any
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
}

export interface ChannelSyncRuns {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId: string
  runType: string
  // Default: 'preview'::text
  status?: string
  // Default: 0
  totalItems?: number
  // Default: 0
  createdCount?: number
  // Default: 0
  updatedCount?: number
  // Default: 0
  failedCount?: number
  // Default: 0
  unmappedCount?: number
  parsedItems?: any
  errorReport?: any
  triggeredBy?: string
  // Default: now()
  startedAt?: string
  committedAt?: string
}

export interface ChannelWebhookEvents {
  // Default: gen_random_uuid()
  id?: string
  channelAccountId?: string
  ttsNotificationId: string
  eventType: string
  payload: any
  signatureValid: boolean
  processedAt?: string
  processingError?: string
  // Default: now()
  receivedAt?: string
}

export interface CommerceChannelAccounts {
  // Default: gen_random_uuid()
  id?: string
  channelType: string
  displayName?: string
  externalShopId?: string
  shopCipher?: string
  marketCountry: string
  marketCurrency: string
  // Default: 'DISCONNECTED'::commerce_channel_account_status
  status?: CommerceChannelAccountStatus
  accessTokenEncrypted?: string
  refreshTokenEncrypted?: string
  // Default: 1
  tokenEncryptionKeyVersion?: number
  accessTokenExpiresAt?: string
  refreshTokenExpiresAt?: string
  // Default: '{}'::text[]
  scopes?: string[]
  connectedBy?: string
  connectedAt?: string
  lastValidatedAt?: string
  lastError?: string
  // Default: false
  disabledByAdmin?: boolean
  // Default: 'READ_ONLY'::text
  syncMode?: string
  // Default: '{}'::jsonb
  metadata?: any
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
  orderImportWatermark?: string
}

export interface CommunicationTimeline {
  // Default: gen_random_uuid()
  id?: string
  customerId: string
  customerEmail?: string
  customerPhone?: string
  channel: AiChannel
  direction: string
  subject?: string
  bodyPreview?: string
  bodyFull?: string
  emailId?: string
  whatsappId?: string
  contactId?: string
  newsletterId?: string
  aiDraftId?: string
  // Default: 'delivered'::character varying
  status?: string
  openedAt?: string
  clickedAt?: string
  // Default: now()
  createdAt?: string
}

export interface ContactAnalytics {
  // Default: gen_random_uuid()
  id?: string
  eventType: string
  subject?: string
  userAgent?: string
  referrer?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface CouponUsage {
  // Default: uuid_generate_v4()
  id?: string
  couponId?: string
  userId?: string
  orderId?: string
  discountApplied: number
  orderTotal?: number
  // Default: CURRENT_TIMESTAMP
  usedAt?: string
  ipAddress?: any
  userAgent?: string
}

export interface Coupons {
  // Default: uuid_generate_v4()
  id?: string
  code: string
  name: string
  description?: string
  // Default: 'percentage'::coupon_type
  discountType?: CouponType
  discountValue: number
  maxDiscountAmount?: number
  usageLimit?: number
  // Default: 0
  usageCount?: number
  // Default: 1
  usageLimitPerUser?: number
  startsAt?: string
  expiresAt?: string
  minPurchaseAmount?: number
  minItemsCount?: number
  // Default: false
  isFirstOrderOnly?: boolean
  // Default: false
  isSingleUse?: boolean
  // Default: false
  isStackable?: boolean
  // Default: 'all'::character varying
  appliesTo?: string
  targetIds?: string[]
  excludedProductIds?: string[]
  excludedCategoryIds?: string[]
  buyQuantity?: number
  getQuantity?: number
  getDiscountPercent?: number
  // Default: 'active'::coupon_status
  status?: CouponStatus
  // Default: true
  isActive?: boolean
  // Default: 0
  totalDiscountGiven?: number
  // Default: 0
  totalOrdersUsed?: number
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface CreatorAuditLogs {
  // Default: uuid_generate_v4()
  id?: string
  creatorProfileId: string
  userId: string
  action: string
  // Default: 'book'::character varying
  entityType?: string
  entityId?: string
  oldValue?: any
  newValue?: any
  meta?: any
  ipAddress?: any
  userAgent?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface CreatorProfiles {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  handle: string
  displayName: string
  bio?: string
  avatarUrl?: string
  websiteUrl?: string
  // Default: '{}'::jsonb
  socialLinks?: any
  payoutAddress?: string
  // Default: 'pending'::character varying
  verificationStatus?: string
  // Default: true
  isPublic?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface DigitalAssets {
  // Default: uuid_generate_v4()
  id?: string
  productId: string
  // Default: 'full'::character varying
  assetType?: string
  storageUrl: string
  mimeType: string
  fileSize?: number
  checksum?: string
  watermarkTemplate?: string
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  formatKey?: string
}

export interface DigitalEntitlements {
  // Default: uuid_generate_v4()
  id?: string
  orderId?: string
  orderItemId?: string
  userId: string
  productId: string
  // Default: 'standard'::character varying
  licenseType?: string
  // Default: CURRENT_TIMESTAMP
  grantedAt?: string
  expiresAt?: string
  // Default: 3
  deviceLimit?: number
  revokedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface DiscoverPostImages {
  // Default: uuid_generate_v4()
  id?: string
  discoverPostId: string
  imageUrl: string
  // Default: 0
  position?: number
}

export interface DiscoverPostLikes {
  // Default: uuid_generate_v4()
  id?: string
  discoverPostId: string
  userId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface DiscoverPostProducts {
  // Default: uuid_generate_v4()
  id?: string
  discoverPostId: string
  productId: string
  // Default: 0
  position?: number
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
}

export interface DiscoverPostSaves {
  // Default: uuid_generate_v4()
  id?: string
  discoverPostId: string
  userId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface DiscoverPosts {
  // Default: uuid_generate_v4()
  id?: string
  mediaType: string
  videoUrl?: string
  videoPosterUrl?: string
  caption?: string
  categoryId?: string
  // Default: true
  isActive?: boolean
  // Default: 0
  position?: number
  // Default: 0
  viewCount?: number
  // Default: 0
  likeCount?: number
  // Default: 0
  saveCount?: number
  // Default: 0
  shareCount?: number
  // Default: 0
  addToCartCount?: number
  // Default: 0
  purchaseCount?: number
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  audioUrl?: string
  audioLabel?: string
  sellerProfileId?: string
  // Default: 'ready'::character varying
  mediaStatus?: string
  mediaError?: string
}

export interface DiscoverPurchaseAttributions {
  orderId: string
  discoverPostId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface EmailAliases {
  // Default: uuid_generate_v4()
  id?: string
  aliasEmail: string
  aliasName: string
  purpose: string
  smtpHost?: string
  // Default: 465
  smtpPort?: number
  // Default: true
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassEncrypted?: string
  // Default: true
  isActive?: boolean
  // Default: false
  isDefault?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface EmailComplaints {
  // Default: uuid_generate_v4()
  id?: string
  recipientEmail: string
  campaignId?: string
  provider?: string
  reason?: string
  metadata?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface EmailMessages {
  // Default: uuid_generate_v4()
  id?: string
  orderId?: string
  recipientEmail: string
  recipientName?: string
  // Default: 'custom'::character varying
  emailType?: string
  subject: string
  bodyHtml?: string
  bodyText?: string
  // Default: 'pending'::character varying
  status?: string
  smtpMessageId?: string
  errorMessage?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  cc?: string
  bcc?: string
  sentAt?: string
  openedAt?: string
  clickedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  metadata?: any
}

export interface EmailSettings {
  // Default: uuid_generate_v4()
  id?: string
  settingKey: string
  settingValue?: string
  // Default: false
  isEncrypted?: boolean
  description?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface EmailTemplates {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  templateKey: string
  subject: string
  bodyHtml: string
  bodyText?: string
  variables?: any
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface EventAggregatesHourly {
  // Default: gen_random_uuid()
  id?: string
  eventType: EventTypeEnum
  source: EventSourceEnum
  hourTimestamp: string
  // Default: 0
  eventCount?: number
  // Default: 0
  uniqueUsers?: number
  // Default: 0
  uniqueSessions?: number
  // Default: 0
  totalValue?: number
  avgDurationMs?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface EventsCore {
  // Default: gen_random_uuid()
  id?: string
  eventType: EventTypeEnum
  userId?: string
  sessionId?: string
  source: EventSourceEnum
  // Default: 'unknown'::device_type_enum
  deviceType?: DeviceTypeEnum
  productId?: string
  sku?: string
  categoryId?: string
  orderId?: string
  supplierId?: string
  campaignId?: string
  promoCodeId?: string
  // Default: '{}'::jsonb
  payload?: any
  value?: number
  durationMs?: number
  eventTime: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface GuestCheckouts {
  // Default: gen_random_uuid()
  id?: string
  email: string
  orderId?: string
  checkoutToken: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: (CURRENT_TIMESTAMP + '7 days'::interval)
  expiresAt?: string
  verifiedAt?: string
  createdByIp?: string
}

export interface HeroSlideCollections {
  // Default: gen_random_uuid()
  id?: string
  heroSlideId: string
  productCollectionId: string
  // Default: 0
  position?: number
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
}

export interface HeroSlideItems {
  // Default: gen_random_uuid()
  id?: string
  heroSlideId: string
  productId: string
  // Default: 0
  position?: number
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
}

export interface HeroSlides {
  // Default: gen_random_uuid()
  id?: string
  slideType: string
  eyebrow?: string
  title?: string
  description?: string
  imageUrl?: string
  ctaLabel?: string
  ctaLink?: string
  secondaryCtaLabel?: string
  secondaryCtaLink?: string
  productId?: string
  categoryId?: string
  productCollectionId?: string
  categoryCollectionId?: string
  // Default: true
  isActive?: boolean
  // Default: 0
  position?: number
  // Default: 'both'::character varying
  platform?: string
  startsAt?: string
  endsAt?: string
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  // Default: 'homepage'::character varying
  placement?: string
}

export interface HomepageSettings {
  // Default: 1
  id?: number
  // Default: '{}'::jsonb
  hero?: any
  // Default: '{}'::jsonb
  workshopBanner?: any
  // Default: '{}'::jsonb
  businessBanner?: any
  // Default: '{}'::jsonb
  newsletter?: any
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  updatedBy?: string
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

export interface NewsletterCampaignRecipients {
  // Default: uuid_generate_v4()
  id?: string
  campaignId: string
  subscriberId: string
  email: string
  // Default: 'pending'::character varying
  status?: string
  sentAt?: string
  openedAt?: string
  clickedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: 0
  attemptCount?: number
  lastAttemptAt?: string
  // Default: CURRENT_TIMESTAMP
  nextAttemptAt?: string
  lastError?: string
  // Default: 'A'::bpchar
  variantKey?: any
}

export interface NewsletterCampaigns {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  subject: string
  contentHtml: string
  contentText?: string
  // Default: 'draft'::character varying
  status?: string
  scheduledAt?: string
  sentAt?: string
  // Default: 0
  totalRecipients?: number
  // Default: 0
  sentCount?: number
  // Default: 0
  deliveredCount?: number
  // Default: 0
  openedCount?: number
  // Default: 0
  clickedCount?: number
  // Default: 0
  bouncedCount?: number
  // Default: 0
  unsubscribedCount?: number
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  // Default: 60
  rateLimitPerMinute?: number
  // Default: 3
  maxRetries?: number
  // Default: 45
  retryBackoffSeconds?: number
  processingStartedAt?: string
  lastProcessedAt?: string
  // Default: false
  abTestEnabled?: boolean
  subjectA?: string
  subjectB?: string
  contentHtmlA?: string
  contentHtmlB?: string
  contentTextA?: string
  contentTextB?: string
  segmentA?: any
  segmentB?: any
  abWinnerVariant?: any
  abRolloutAt?: string
}

export interface NewsletterConversionEvents {
  // Default: uuid_generate_v4()
  id?: string
  campaignId: string
  linkEventId: string
  orderId: string
  recipientEmail: string
  productSlug?: string
  // Default: 0
  orderTotal?: number
  // Default: CURRENT_TIMESTAMP
  attributedAt?: string
}

export interface NewsletterLinkEvents {
  // Default: uuid_generate_v4()
  id?: string
  token: string
  campaignId: string
  recipientId: string
  recipientEmail: string
  variantKey: any
  destinationUrl: string
  productSlug?: string
  linkPosition?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  clickedAt?: string
  // Default: 0
  clickCount?: number
  clickedIp?: string
  clickedUserAgent?: string
}

export interface NewsletterSettings {
  // Default: uuid_generate_v4()
  id?: string
  settingKey: string
  settingValue?: string
  description?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface NewsletterSubscribers {
  // Default: uuid_generate_v4()
  id?: string
  email: string
  name?: string
  // Default: 'active'::character varying
  status?: string
  // Default: 'website'::character varying
  source?: string
  ipAddress?: string
  userAgent?: string
  confirmedAt?: string
  unsubscribedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface NotificationDeliveryLogs {
  // Default: gen_random_uuid()
  id?: string
  notificationId?: string
  channel: string
  // Default: 'pending'::character varying
  status?: string
  recipient?: string
  responseCode?: string
  errorMessage?: string
  // Default: 0
  retryCount?: number
  // Default: 3
  maxRetries?: number
  sentAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface NotificationTemplates {
  // Default: gen_random_uuid()
  id?: string
  typeId: string
  name: string
  subject?: string
  inAppTitle?: string
  inAppMessage?: string
  emailTemplate?: string
  smsTemplate?: string
  pushTitle?: string
  pushMessage?: string
  // Default: '[]'::jsonb
  variables?: any
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface NotificationTypes {
  // Default: gen_random_uuid()
  id?: string
  key: string
  name: string
  description?: string
  icon?: string
  color?: string
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface Notifications {
  // Default: gen_random_uuid()
  id?: string
  userId: string
  typeId?: string
  title: string
  message: string
  description?: string
  icon?: string
  actionUrl?: string
  actionLabel?: string
  // Default: '{}'::jsonb
  data?: any
  // Default: false
  isRead?: boolean
  // Default: false
  isArchived?: boolean
  readAt?: string
  // Default: false
  emailSent?: boolean
  // Default: false
  pushSent?: boolean
  // Default: false
  smsSent?: boolean
  emailSentAt?: string
  pushSentAt?: string
  smsSentAt?: string
  // Default: 'normal'::character varying
  priority?: string
  expiresAt?: string
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
  discoverPostId?: string
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
  // Default: 'EUR'::character varying
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
  guestEmail?: string
  guestFirstName?: string
  guestLastName?: string
  guestPhone?: string
  confirmationSentAt?: string
  // Default: 0
  storeCreditApplied?: number
  recoveryEmailSentAt?: string
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
  stripePaymentIntentId?: string
}

export interface ProductAttributeValues {
  // Default: uuid_generate_v4()
  id?: string
  productId: string
  attributeId: string
  value: string
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

export interface ProductOperationalFlags {
  productId: string
  // Default: false
  autoPause?: boolean
  pauseReason?: string
  // Default: false
  isPublishBlocked?: boolean
  publishBlockReason?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ProductReviewSummary {
  productId: string
  // Default: 0
  totalReviews?: number
  // Default: 0
  averageRating?: number
  // Default: 0
  rating1Count?: number
  // Default: 0
  rating2Count?: number
  // Default: 0
  rating3Count?: number
  // Default: 0
  rating4Count?: number
  // Default: 0
  rating5Count?: number
  // Default: 0
  verifiedPurchaseCount?: number
  // Default: 0
  withImagesCount?: number
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

export interface ProductUnitEconomics {
  productId: string
  // Default: 0
  sellPrice?: number
  // Default: 0
  landedCost?: number
  // Default: 0
  paymentFee?: number
  // Default: 0
  adCostPerOrder?: number
  // Default: 0
  expectedRefundCost?: number
  // Default: 0
  grossMargin?: number
  // Default: 0
  contributionMargin?: number
  // Default: 0
  marginPercent?: number
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
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
  // Default: 0
  stockQuantity?: number
  // Default: 'physical'::character varying
  productKind?: string
  creatorProfileId?: string
  // Default: 'draft'::character varying
  publicationStatus?: string
  // Default: false
  rightsDeclared?: boolean
  rightsDeclaredAt?: string
  // Default: false
  creatorTermsAccepted?: boolean
  submittedForReviewAt?: string
  reviewedBy?: string
  reviewedAt?: string
  moderationNotes?: string
  // Default: false
  adminOrigin?: boolean
  createdByAdminId?: string
  lastUploadedByAdminId?: string
  sellerProfileId?: string
  deliveryTemplateId?: string
}

export interface PromotionActivityLog {
  // Default: gen_random_uuid()
  id?: string
  campaignId: string
  channelPostId?: string
  actorUserId?: string
  action: string
  // Default: '{}'::jsonb
  metadata?: any
  // Default: now()
  createdAt?: string
}

export interface PromotionCampaignProducts {
  // Default: gen_random_uuid()
  id?: string
  campaignId: string
  productId?: string
  // Default: 0
  displayOrder?: number
  snapshotName: string
  snapshotSlug?: string
  snapshotPrice?: number
  snapshotCurrency?: string
  snapshotImageUrl?: string
  // Default: now()
  createdAt?: string
}

export interface PromotionCampaigns {
  // Default: gen_random_uuid()
  id?: string
  name: string
  campaignKey: string
  // Default: 'DRAFT'::promotion_campaign_status
  status?: PromotionCampaignStatus
  objective?: string
  // Default: ''::text
  masterMessage?: string
  couponId?: string
  landingUrl?: string
  // Default: '[]'::jsonb
  creativeAssets?: any
  // Default: 'UTC'::text
  timezone?: string
  scheduledAt?: string
  publishedAt?: string
  completedAt?: string
  createdBy: string
  updatedBy?: string
  marketScope?: string[]
  // Default: true
  dryRun?: boolean
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
}

export interface PromotionChannelPosts {
  // Default: gen_random_uuid()
  id?: string
  campaignId: string
  channel: SocialPlatform
  connectionId?: string
  // Default: 'DRAFT'::promotion_channel_post_status
  status?: PromotionChannelPostStatus
  messageOverride?: string
  // Default: '{}'::text[]
  hashtags?: string[]
  creativeAssetKey?: string
  linkUrl?: string
  scheduledAt?: string
  queuedAt?: string
  publishingStartedAt?: string
  publishedAt?: string
  remotePostId?: string
  remotePermalink?: string
  lastError?: string
  lastErrorCode?: string
  // Default: 0
  attemptCount?: number
  // Default: 3
  maxRetries?: number
  nextAttemptAt?: string
  // Default: true
  dryRun?: boolean
  validationErrors?: any
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
}

export interface ReadingProgress {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  productId: string
  locationRef?: string
  // Default: 0
  percentComplete?: number
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface ReviewImages {
  // Default: uuid_generate_v4()
  id?: string
  reviewId?: string
  imageUrl: string
  thumbnailUrl?: string
  altText?: string
  // Default: 0
  sortOrder?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface ReviewResponses {
  // Default: uuid_generate_v4()
  id?: string
  reviewId?: string
  responderId?: string
  response: string
  // Default: true
  isOfficial?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ReviewVotes {
  // Default: uuid_generate_v4()
  id?: string
  reviewId?: string
  userId?: string
  voteType?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
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
  // Default: 0
  imagesCount?: number
  adminResponse?: string
  responseAt?: string
  // Default: false
  isFeatured?: boolean
  // Default: 'pending'::character varying
  status?: string
  // Default: 0
  reportedCount?: number
}

export interface SchemaMigrations {
  // Default: nextval('schema_migrations_id_seq'::regclass)
  id?: number
  filename: string
  // Default: CURRENT_TIMESTAMP
  executedAt?: string
}

export interface SellerAnnouncementReads {
  // Default: uuid_generate_v4()
  id?: string
  announcementId: string
  sellerProfileId: string
  // Default: CURRENT_TIMESTAMP
  readAt?: string
}

export interface SellerAnnouncements {
  // Default: uuid_generate_v4()
  id?: string
  subject: string
  body: string
  targetTier?: string
  createdByAdminId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SellerAuditLog {
  // Default: uuid_generate_v4()
  id?: string
  sellerProfileId: string
  userId: string
  actorId?: string
  action: string
  previousState?: any
  newState?: any
  details?: any
  ipAddress?: any
  userAgent?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SellerEarningItems {
  // Default: uuid_generate_v4()
  id?: string
  sellerEarningId: string
  orderItemId: string
  itemGrossAmount: number
}

export interface SellerEarnings {
  // Default: uuid_generate_v4()
  id?: string
  sellerProfileId: string
  orderId: string
  grossItemAmount: number
  sellerTierSnapshot: SellerTier
  commissionRateSnapshot: number
  platformCommissionAmount: number
  sellerNetAmount: number
  // Default: 'pending'::seller_earning_status
  status?: SellerEarningStatus
  cancelledReason?: string
  clawedBackAt?: string
  payoutBatchId?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  confirmedAt?: string
  cancelledAt?: string
  paidAt?: string
}

export interface SellerFollows {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  sellerProfileId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SellerPayoutBatches {
  // Default: uuid_generate_v4()
  id?: string
  sellerProfileId: string
  totalAmount: number
  payoutMethod?: string
  payoutReference?: string
  notes?: string
  // Default: CURRENT_TIMESTAMP
  sentAt?: string
  sentByAdminId: string
  // Default: 'sent'::character varying
  payoutStatus?: string
  stripeTransferId?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SellerPayoutLedger {
  // Default: uuid_generate_v4()
  id?: string
  sellerProfileId: string
  deltaAmount: number
  reason: string
  referenceType?: string
  referenceId?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SellerPayoutSettings {
  // Default: 1
  id?: number
  // Default: 30
  fallbackHoldPeriodDays?: number
  // Default: 0
  minPayoutAmount?: number
  // Default: true
  programEnabled?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface SellerProfiles {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  displayName?: string
  handle?: string
  bio?: string
  avatarUrl?: string
  bannerUrl?: string
  // Default: 'unverified'::seller_tier
  tier?: SellerTier
  // Default: 'NOT_STARTED'::seller_profile_verification_status
  verificationStatus?: SellerProfileVerificationStatus
  // Default: 5
  maxActiveListings?: number
  // Default: 99.99
  maxProductPrice?: number
  // Default: 0
  totalSales?: number
  // Default: 0.00
  totalRevenue?: number
  averageRating?: number
  // Default: 0
  reviewCount?: number
  // Default: 0
  disputeCount?: number
  // Default: 0
  disputeWinCount?: number
  // Default: false
  phoneVerified?: boolean
  // Default: false
  idVerified?: boolean
  // Default: false
  paymentMethodVerified?: boolean
  // Default: false
  termsAccepted?: boolean
  termsAcceptedAt?: string
  verifiedAt?: string
  verifiedByAdminId?: string
  // Default: true
  isActive?: boolean
  // Default: false
  isSuspended?: boolean
  suspensionReason?: string
  suspendedAt?: string
  suspendedByAdminId?: string
  metadata?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  // Default: 'DRAFT'::seller_account_status
  accountStatus?: SellerAccountStatus
  // Default: 'DRAFT'::seller_store_status
  storeStatus?: SellerStoreStatus
  // Default: 'NOT_STARTED'::seller_onboarding_status
  onboardingStatus?: SellerOnboardingStatus
  sellerType?: SellerApplicantType
  sellerTypeDetails?: any
  accountStatusUpdatedAt?: string
  storeStatusUpdatedAt?: string
}

export interface SellerTierConfig {
  tier: SellerTier
  maxActiveListings: number
  maxProductPrice?: number
  // Default: 15.00
  commissionRate?: number
  // Default: false
  requiresPhoneVerification?: boolean
  // Default: false
  requiresIdVerification?: boolean
  // Default: false
  requiresPaymentMethod?: boolean
  // Default: false
  requiresAdminApproval?: boolean
  // Default: 'standard'::character varying
  buyerProtectionLevel?: string
  description?: string
  payoutHoldPeriodDays: number
}

export interface SellerVerificationDocuments {
  // Default: uuid_generate_v4()
  id?: string
  sellerProfileId: string
  userId: string
  verificationRequestId?: string
  category: SellerDocumentCategory
  storageProvider: string
  storageKey: string
  contentType: string
  byteSize: number
  checksumSha256?: string
  // Default: 'uploaded'::character varying
  uploadStatus?: string
  // Default: 'pending'::seller_document_review_status
  reviewStatus?: SellerDocumentReviewStatus
  reviewNotes?: string
  reviewedByAdminId?: string
  reviewedAt?: string
  // Default: 'not_scanned'::seller_document_scan_status
  malwareScanStatus?: SellerDocumentScanStatus
  // Default: true
  isCurrent?: boolean
  replacesDocumentId?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface SellerVerificationRequests {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  sellerProfileId: string
  requestedTier: SellerTier
  // Default: 'PENDING'::seller_verification_case_status
  status?: SellerVerificationCaseStatus
  documentsSubmitted?: any
  notes?: string
  reviewedByAdminId?: string
  reviewedAt?: string
  adminNotes?: string
  adminDecisionReason?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  // Default: 'tier_upgrade'::character varying
  caseType?: string
  moreInformationRequestedAt?: string
}

export interface ShippingCarriers {
  // Default: uuid_generate_v4()
  id?: string
  carrierCode: string
  carrierName: string
  description?: string
  logoUrl?: string
  // Default: false
  isActive?: boolean
  // Default: true
  isSandbox?: boolean
  // Default: '{}'::jsonb
  credentials?: any
  // Default: '{}'::jsonb
  settings?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ShippingDeliveryTemplateCategories {
  // Default: uuid_generate_v4()
  id?: string
  templateId: string
  categoryId: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface ShippingDeliveryTemplates {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  scopeType: string
  // Default: '{}'::text[]
  countries?: string[]
  // Default: 1
  processingDaysMin?: number
  // Default: 2
  processingDaysMax?: number
  // Default: 2
  transitDaysMin?: number
  // Default: 4
  transitDaysMax?: number
  expressTransitDaysMin?: number
  expressTransitDaysMax?: number
  cutoffTime?: string
  cutoffTimezone?: string
  // Default: true
  skipWeekends?: boolean
  // Default: 'FREE Delivery'::character varying
  standardLabel?: string
  // Default: 'Or fastest delivery'::character varying
  expressLabel?: string
  // Default: true
  isActive?: boolean
  // Default: false
  isDefault?: boolean
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ShippingLabels {
  // Default: uuid_generate_v4()
  id?: string
  orderId?: string
  carrier: string
  serviceCode: string
  trackingNumber: string
  labelData?: string
  // Default: 'PDF'::character varying
  labelFormat?: string
  cost?: number
  // Default: 'created'::character varying
  status?: string
  voidedAt?: string
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ShippingMethods {
  // Default: uuid_generate_v4()
  id?: string
  zoneId?: string
  name: string
  description?: string
  // Default: 'flat_rate'::character varying
  methodType?: string
  carrier?: string
  carrierServiceCode?: string
  flatRate?: number
  minWeight?: number
  maxWeight?: number
  minOrderAmount?: number
  maxOrderAmount?: number
  ratePerKg?: number
  // Default: true
  isActive?: boolean
  // Default: 0
  displayOrder?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ShippingSettings {
  // Default: 1
  id?: number
  // Default: 'lb'::character varying
  defaultWeightUnit?: string
  // Default: 'in'::character varying
  defaultDimensionUnit?: string
  // Default: 'US'::character varying
  defaultCountry?: string
  freeShippingThreshold?: number
  // Default: 0
  handlingFee?: number
  // Default: false
  insuranceEnabled?: boolean
  // Default: false
  signatureRequired?: boolean
  originAddress?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface ShippingTrackingHistory {
  // Default: uuid_generate_v4()
  id?: string
  labelId?: string
  trackingNumber: string
  carrier: string
  status?: string
  statusDescription?: string
  location?: string
  eventTimestamp?: string
  rawData?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface ShippingZones {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  // Default: '{}'::text[]
  countries?: string[]
  // Default: '{}'::text[]
  states?: string[]
  // Default: '{}'::text[]
  postalCodes?: string[]
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface SocialConnections {
  // Default: gen_random_uuid()
  id?: string
  platform: SocialPlatform
  displayName?: string
  externalAccountId?: string
  // Default: 'DISCONNECTED'::social_connection_status
  status?: SocialConnectionStatus
  accessTokenEncrypted?: string
  refreshTokenEncrypted?: string
  // Default: 1
  tokenEncryptionKeyVersion?: number
  tokenExpiresAt?: string
  // Default: '{}'::text[]
  scopes?: string[]
  connectedBy?: string
  connectedAt?: string
  lastValidatedAt?: string
  lastError?: string
  // Default: false
  disabledByAdmin?: boolean
  // Default: '{}'::jsonb
  metadata?: any
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
}

export interface SocialMetricSnapshots {
  // Default: gen_random_uuid()
  id?: string
  channelPostId: string
  // Default: now()
  capturedAt?: string
  impressions?: number
  reach?: number
  likes?: number
  comments?: number
  shares?: number
  clicks?: number
  // Default: '{}'::jsonb
  rawMetrics?: any
}

export interface SocialPublishAttempts {
  // Default: gen_random_uuid()
  id?: string
  channelPostId: string
  attemptNumber: number
  // Default: true
  dryRun?: boolean
  // Default: '{}'::jsonb
  requestPayload?: any
  responseStatus: string
  remotePostId?: string
  errorCode?: string
  errorMessage?: string
  // Default: now()
  startedAt?: string
  finishedAt?: string
}

export interface SourcedProducts {
  // Default: uuid_generate_v4()
  id?: string
  // Default: 'captured'::character varying
  status?: string
  sourcePlatform: string
  sourceUrl: string
  sourceProductId?: string
  capturedTitle: string
  capturedDescriptionHtml?: string
  // Default: '[]'::jsonb
  capturedImages?: any
  // Default: '[]'::jsonb
  capturedPriceTiers?: any
  // Default: '[]'::jsonb
  capturedVariantOptions?: any
  // Default: '{}'::jsonb
  capturedSpecs?: any
  // Default: 'USD'::bpchar
  capturedCurrency?: any
  capturedCostPriceOriginal?: number
  capturedCostPriceEur?: number
  fxRateUsed?: number
  fxRateSource?: string
  // Default: CURRENT_TIMESTAMP
  capturedAt?: string
  capturedByTokenId?: string
  capturedByUserId: string
  rewrittenTitle?: string
  rewrittenDescriptionHtml?: string
  rewriteModelName?: string
  rewriteConfidence?: number
  rewriteNotes?: string
  rewriteAttemptedAt?: string
  rewriteError?: string
  // Default: 0
  rewriteAttemptCount?: number
  reviewTitle?: string
  reviewDescriptionHtml?: string
  reviewImages?: any
  reviewedBy?: string
  reviewedAt?: string
  suggestedSalePrice?: number
  suggestedMarginPercent?: number
  pricingRuleId?: string
  finalCostPrice?: number
  finalSalePrice?: number
  committedProductId?: string
  committedAt?: string
  committedBy?: string
  discardReason?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  reviewSpecs?: any
  capturedSupplierName?: string
  rewrittenCategoryId?: string
  rewrittenMetaTitle?: string
  rewrittenMetaDescription?: string
  reviewCategoryId?: string
  reviewMetaTitle?: string
  reviewMetaDescription?: string
}

export interface SourcingApiTokens {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  name: string
  tokenPrefix: string
  tokenHash: string
  // Default: ARRAY['sourcing.import'::text]
  scopes?: string[]
  lastUsedAt?: string
  lastUsedIp?: any
  expiresAt?: string
  revokedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SourcingPricingRules {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  ruleType: string
  marginPercent?: number
  fixedMarkup?: number
  // Default: 'charm'::character varying
  roundingMode?: string
  // Default: false
  isDefault?: boolean
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface StaffAuditLog {
  // Default: gen_random_uuid()
  id?: string
  staffMembershipId?: string
  action: string
  actorUserId?: string
  targetUserId?: string
  beforeState?: any
  afterState?: any
  // Default: '{}'::jsonb
  metadata?: any
  // Default: now()
  createdAt?: string
}

export interface StaffMemberships {
  // Default: gen_random_uuid()
  id?: string
  userId: string
  role: StaffRole
  marketScope?: string[]
  // Default: 'ACTIVE'::staff_membership_status
  status?: StaffMembershipStatus
  grantedBy?: string
  // Default: now()
  grantedAt?: string
  suspendedAt?: string
  suspendedBy?: string
  revokedAt?: string
  revokedBy?: string
  // Default: now()
  createdAt?: string
  // Default: now()
  updatedAt?: string
}

export interface StoreCreditLedger {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  deltaAmount: number
  reason: string
  referenceType?: string
  referenceId?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface StripeWebhookEvents {
  // Default: gen_random_uuid()
  id?: string
  eventId: string
  eventType: string
  // Default: CURRENT_TIMESTAMP
  processedAt?: string
  payload?: any
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SupplierImportBatches {
  // Default: uuid_generate_v4()
  id?: string
  supplierId: string
  filename: string
  // Default: 'preview'::character varying
  status?: string
  // Default: 0
  totalRows?: number
  // Default: 0
  createdCount?: number
  // Default: 0
  updatedCount?: number
  // Default: 0
  failedCount?: number
  parsedRows?: any
  errorReport?: any
  createdBy?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  committedAt?: string
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
  // Default: 'EUR'::bpchar
  currencyCode?: any
  // Default: false
  isPrimary?: boolean
  leadTimeDays?: number
  supplierUrl?: string
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
  // Default: 'other'::character varying
  sourcePlatform?: string
  countryCode?: any
  // Default: 'active'::character varying
  status?: string
  rating?: number
  onTimeRate?: number
  defectRate?: number
  refundRate?: number
  deletedAt?: string
}

export interface SupportMessages {
  // Default: uuid_generate_v4()
  id?: string
  ticketId: string
  senderType: string
  senderUserId: string
  body: string
  // Default: false
  isInternalNote?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface SupportTickets {
  // Default: uuid_generate_v4()
  id?: string
  sellerProfileId: string
  userId: string
  subject: string
  // Default: 'other'::character varying
  category?: string
  // Default: 'open'::character varying
  status?: string
  // Default: 'normal'::character varying
  priority?: string
  assignedToUserId?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
  // Default: CURRENT_TIMESTAMP
  lastMessageAt?: string
  resolvedAt?: string
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

export interface UserBusinessModeAudit {
  // Default: uuid_generate_v4()
  id?: string
  userId: string
  action: string
  metadata?: any
  ipAddress?: any
  userAgent?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
}

export interface UserCoupons {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  couponId?: string
  // Default: CURRENT_TIMESTAMP
  assignedAt?: string
  usedAt?: string
  // Default: false
  isUsed?: boolean
}

export interface UserDevices {
  // Default: gen_random_uuid()
  id?: string
  userId: string
  deviceId: string
  pushToken?: string
  platform?: string
  // Default: CURRENT_TIMESTAMP
  lastActiveAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface UserNotificationSettings {
  // Default: gen_random_uuid()
  id?: string
  userId: string
  notificationTypeId?: string
  // Default: true
  inApp?: boolean
  // Default: true
  email?: boolean
  // Default: true
  push?: boolean
  // Default: false
  sms?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface UserSessions {
  // Default: gen_random_uuid()
  id?: string
  userId?: string
  sessionId: string
  source: EventSourceEnum
  // Default: 'unknown'::device_type_enum
  deviceType?: DeviceTypeEnum
  osName?: string
  osVersion?: string
  browserName?: string
  browserVersion?: string
  ipAddress?: any
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  // Default: CURRENT_TIMESTAMP
  startTime?: string
  // Default: CURRENT_TIMESTAMP
  lastActivityTime?: string
  endTime?: string
  sessionDurationSeconds?: number
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  countryCode?: any
  countryName?: string
  city?: string
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
  stripeCustomerId?: string
  // Default: false
  isBusinessAccount?: boolean
  businessModeActivatedAt?: string
  businessModeSource?: string
}

export interface Web3BookAssets {
  // Default: uuid_generate_v4()
  id?: string
  productId: string
  chainId?: number
  contractAddress?: string
  tokenStandard?: string
  tokenId?: string
  // Default: 0
  royaltyBps?: number
  metadataUri?: string
  mintedAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface WhatsappMessages {
  // Default: uuid_generate_v4()
  id?: string
  orderId?: string
  recipientPhone: string
  // Default: 'custom'::character varying
  messageType?: string
  messageContent: string
  // Default: 'pending'::character varying
  status?: string
  providerMessageId?: string
  errorMessage?: string
  sentAt?: string
  deliveredAt?: string
  readAt?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface WhatsappSettings {
  // Default: uuid_generate_v4()
  id?: string
  settingKey: string
  settingValue?: string
  // Default: false
  isEncrypted?: boolean
  description?: string
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface WhatsappTemplates {
  // Default: uuid_generate_v4()
  id?: string
  name: string
  templateKey: string
  messageContent: string
  variables?: any
  // Default: true
  isActive?: boolean
  // Default: CURRENT_TIMESTAMP
  createdAt?: string
  // Default: CURRENT_TIMESTAMP
  updatedAt?: string
}

export interface Wishlist {
  // Default: uuid_generate_v4()
  id?: string
  userId?: string
  productId?: string
  // Default: CURRENT_TIMESTAMP
  addedAt?: string
  lastCheckedPrice?: number
  lastCheckedInStock?: boolean
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

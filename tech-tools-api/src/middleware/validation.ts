import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import logger from '../utils/logger'

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    })

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }))

      logger.debug('Validation failed:', errors)

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      })
    }

    // Replace request body with validated values
    req.body = value
    next()
  }
}

// Common validation schemas
export const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().max(100).required(),
    lastName: Joi.string().max(100).required(),
    phone: Joi.string().max(20),
    userType: Joi.string()
      .valid('customer', 'supplier', 'admin')
      .default('customer'),
    companyName: Joi.string().max(255).when('userType', {
      is: 'supplier',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),
}

export const userSchemas = {
  updateProfile: Joi.object({
    firstName: Joi.string().max(100),
    lastName: Joi.string().max(100),
    phone: Joi.string().max(20),
    companyName: Joi.string().max(255),
  }),

  activateBusinessMode: Joi.object({
    displayName: Joi.string().max(140),
    handle: Joi.string().max(80),
    companyName: Joi.string().max(255),
    businessType: Joi.string().max(50),
    source: Joi.string().max(50),
  }),

  updateAddress: Joi.object({
    addressType: Joi.string().valid('shipping', 'billing').default('shipping'),
    fullName: Joi.string().max(200),
    addressLine1: Joi.string().max(255).required(),
    addressLine2: Joi.string().max(255),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100),
    country: Joi.string().max(100).required(),
    postalCode: Joi.string().max(20).required(),
    phone: Joi.string().max(20),
    isDefault: Joi.boolean(),
  }),
}

export const productSchemas = {
  // NOTE: this schema uses stripUnknown (see validate() below), so any
  // field updateProduct/createProduct legitimately accept but this schema
  // doesn't declare gets silently deleted from req.body before the
  // controller ever runs -- confirmed live (2026-08-24): stockQuantity was
  // missing here, so editing a product's stock quantity and saving had no
  // effect at all, even though the controller-side logic was correct.
  create: Joi.object({
    sku: Joi.string().max(100).required(),
    name: Joi.string().max(255).required(),
    slug: Joi.string().max(255).required(),
    description: Joi.string().allow(''),
    shortDescription: Joi.string().max(500),
    brandId: Joi.string().uuid(),
    categoryId: Joi.string().uuid().required(),
    basePrice: Joi.number().min(0).required(),
    salePrice: Joi.number().min(0),
    costPrice: Joi.number().min(0),
    taxRate: Joi.number().min(0).max(100),
    stockQuantity: Joi.number().integer().min(0),
    weight: Joi.number().min(0),
    weightUnit: Joi.string().max(10),
    length: Joi.number().min(0),
    width: Joi.number().min(0),
    height: Joi.number().min(0),
    dimensionsUnit: Joi.string().max(10),
    isActive: Joi.boolean().default(true),
    isDigital: Joi.boolean().default(false),
    isFeatured: Joi.boolean().default(false),
    isBackorderAllowed: Joi.boolean(),
    minOrderQuantity: Joi.number().integer().min(1).default(1),
    maxOrderQuantity: Joi.number().integer().min(1),
    metaTitle: Joi.string().max(255),
    metaDescription: Joi.string().max(500),
    deliveryTemplateId: Joi.string().uuid().allow(null),
  }),

  update: Joi.object({
    sku: Joi.string().max(100),
    name: Joi.string().max(255),
    slug: Joi.string().max(255),
    description: Joi.string().allow(''),
    shortDescription: Joi.string().max(500),
    brandId: Joi.string().uuid().allow(null),
    categoryId: Joi.string().uuid().allow(null),
    basePrice: Joi.number().min(0),
    salePrice: Joi.number().min(0).allow(null),
    costPrice: Joi.number().min(0).allow(null),
    taxRate: Joi.number().min(0).max(100).allow(null),
    stockQuantity: Joi.number().integer().min(0),
    weight: Joi.number().min(0).allow(null),
    weightUnit: Joi.string().max(10).allow(null),
    length: Joi.number().min(0).allow(null),
    width: Joi.number().min(0).allow(null),
    height: Joi.number().min(0).allow(null),
    dimensionsUnit: Joi.string().max(10).allow(null),
    isActive: Joi.boolean(),
    isDigital: Joi.boolean(),
    isFeatured: Joi.boolean(),
    isBackorderAllowed: Joi.boolean(),
    minOrderQuantity: Joi.number().integer().min(1),
    maxOrderQuantity: Joi.number().integer().min(1).allow(null),
    metaTitle: Joi.string().max(255).allow(null, ''),
    metaDescription: Joi.string().max(500).allow(null, ''),
    deliveryTemplateId: Joi.string().uuid().allow(null),
  }),
}

export const adminBookSchemas = {
  createBook: Joi.object({
    name: Joi.string().max(255).required(),
    slug: Joi.string().max(255),
    description: Joi.string().allow('', null),
    shortDescription: Joi.string().max(500).allow('', null),
    basePrice: Joi.number().min(0).required(),
    salePrice: Joi.number().min(0),
    format: Joi.string().valid('pdf', 'epub', 'mobi', 'azw3', 'html', 'audio'),
    fileUrl: Joi.string().uri(),
    previewUrl: Joi.string().uri(),
    coverImageUrl: Joi.string().uri(),
    languageCode: Joi.string().max(10),
    pageCount: Joi.number().integer().min(1),
    isbn: Joi.string().max(32),
    publisherName: Joi.string().max(255),
    publicationDate: Joi.string().isoDate(),
    drmEnabled: Joi.boolean(),
    metadata: Joi.object().unknown(true),
    publicationAction: Joi.string().valid('draft', 'submit', 'publish'),
    moderationNotes: Joi.string().max(2000),
    idempotencyKey: Joi.string().min(8).max(128),
  }),

  submitBook: Joi.object({
    notes: Joi.string().max(2000),
  }),

  publishBook: Joi.object({
    moderationNotes: Joi.string().max(2000),
  }),
}

const individualSellerTypeDetails = Joi.object({
  legalFirstName: Joi.string().max(140),
  legalLastName: Joi.string().max(140),
  dateOfBirth: Joi.string().isoDate(),
  country: Joi.string().max(80),
  nationality: Joi.string().max(80),
  residentialAddress: Joi.object().unknown(true),
  phoneNumber: Joi.string().max(30),
}).unknown(true)

const businessSellerTypeDetails = Joi.object({
  legalBusinessName: Joi.string().max(200),
  registrationNumber: Joi.string().max(100),
  taxId: Joi.string().max(100),
  countryOfRegistration: Joi.string().max(80),
  registeredAddress: Joi.object().unknown(true),
  legalRepresentative: Joi.object().unknown(true),
  businessContact: Joi.object().unknown(true),
}).unknown(true)

export const sellerSchemas = {
  onboard: Joi.object({
    displayName: Joi.string().max(140),
    handle: Joi.string().max(80),
    bio: Joi.string().max(3000),
    avatarUrl: Joi.string().uri(),
    bannerUrl: Joi.string().uri(),
    metadata: Joi.object().unknown(true),
    source: Joi.string().max(60),
    termsAccepted: Joi.boolean(),
    sellerType: Joi.string().valid('individual', 'registered_business'),
    sellerTypeDetails: Joi.alternatives().conditional('sellerType', {
      is: 'registered_business',
      then: businessSellerTypeDetails,
      otherwise: individualSellerTypeDetails,
    }),
  }),

  requestVerification: Joi.object({
    requestedTier: Joi.string()
      .valid('basic', 'trusted', 'pro')
      .default('basic'),
  }),

  submitApplication: Joi.object({
    requestedTier: Joi.string().valid('basic', 'trusted', 'pro'),
  }),

  uploadDocument: Joi.object({
    category: Joi.string()
      .valid('identity_document', 'proof_of_address', 'business_registration', 'tax_document', 'additional_requested')
      .required(),
  }),
}

export const creatorSchemas = {
  updateProduct: Joi.object({
    basePrice: Joi.number().min(0),
    salePrice: Joi.number().min(0).allow(null),
    description: Joi.string().allow(''),
    shortDescription: Joi.string().max(500).allow(''),
    publicationStatus: Joi.string().valid('draft'),
  }).min(1),
}

export const adminSellerSchemas = {
  approveVerification: Joi.object({
    adminNotes: Joi.string().max(4000),
    decisionReason: Joi.string().max(2000),
    phoneVerified: Joi.boolean(),
    paymentMethodVerified: Joi.boolean(),
    grantedTier: Joi.string().valid('unverified', 'basic', 'trusted', 'pro'),
  }),

  rejectVerification: Joi.object({
    adminNotes: Joi.string().max(4000),
    decisionReason: Joi.string().max(2000).required(),
  }),

  requestMoreInfo: Joi.object({
    reason: Joi.string().max(2000).required(),
  }),

  suspendSeller: Joi.object({
    suspensionReason: Joi.string().max(4000).required(),
  }),

  restrictSeller: Joi.object({
    reason: Joi.string().max(2000).required(),
  }),

  closeSeller: Joi.object({
    reason: Joi.string().max(2000).required(),
  }),

  setStoreStatus: Joi.object({
    toStatus: Joi.string().valid('DRAFT', 'READY', 'LIVE', 'PAUSED', 'CLOSED').required(),
    reason: Joi.string().max(2000),
  }),

  reviewDocument: Joi.object({
    reviewStatus: Joi.string().valid('accepted', 'rejected').required(),
    reviewNotes: Joi.string().max(4000),
  }),

  setCreatorAccess: Joi.object({
    accessEnabled: Joi.boolean().required(),
    reason: Joi.string().max(2000),
  }),

  grantSellerAccess: Joi.object({
    userId: Joi.string().uuid().required(),
    tier: Joi.string().valid('unverified', 'basic', 'trusted', 'pro'),
  }),

  setSellerTier: Joi.object({
    tier: Joi.string().valid('unverified', 'basic', 'trusted', 'pro').required(),
  }),
}

export const sellerSupportSchemas = {
  createTicket: Joi.object({
    subject: Joi.string().max(255).required(),
    category: Joi.string().valid('payouts', 'verification', 'product_listing', 'technical', 'other'),
    body: Joi.string().max(8000).required(),
  }),

  reply: Joi.object({
    body: Joi.string().max(8000).required(),
  }),
}

export const adminSupportTicketSchemas = {
  create: Joi.object({
    sellerProfileId: Joi.string().uuid().required(),
    subject: Joi.string().max(255).required(),
    category: Joi.string().valid('payouts', 'verification', 'product_listing', 'technical', 'other'),
    body: Joi.string().max(8000).required(),
  }),

  reply: Joi.object({
    body: Joi.string().max(8000).required(),
    isInternalNote: Joi.boolean(),
  }),

  assign: Joi.object({
    userId: Joi.string().uuid().allow(null),
  }),

  status: Joi.object({
    status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').required(),
  }),
}

export const adminAnnouncementSchemas = {
  create: Joi.object({
    subject: Joi.string().max(255).required(),
    body: Joi.string().max(8000).required(),
    targetTier: Joi.string().valid('unverified', 'basic', 'trusted', 'pro').allow(null),
  }),
}

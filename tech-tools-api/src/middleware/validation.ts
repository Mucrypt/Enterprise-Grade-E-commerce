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
    weight: Joi.number().min(0),
    weightUnit: Joi.string().max(10),
    isActive: Joi.boolean().default(true),
    isDigital: Joi.boolean().default(false),
    isFeatured: Joi.boolean().default(false),
    minOrderQuantity: Joi.number().integer().min(1).default(1),
    maxOrderQuantity: Joi.number().integer().min(1),
  }),

  update: Joi.object({
    name: Joi.string().max(255),
    slug: Joi.string().max(255),
    description: Joi.string().allow(''),
    shortDescription: Joi.string().max(500),
    basePrice: Joi.number().min(0),
    salePrice: Joi.number().min(0),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    minOrderQuantity: Joi.number().integer().min(1),
    maxOrderQuantity: Joi.number().integer().min(1),
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
  }),

  requestVerification: Joi.object({
    requestedTier: Joi.string()
      .valid('basic', 'trusted', 'pro')
      .default('basic'),
    documentsSubmitted: Joi.array().items(Joi.object().unknown(true)).max(20),
    notes: Joi.string().max(4000),
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
    idVerified: Joi.boolean(),
    paymentMethodVerified: Joi.boolean(),
  }),

  rejectVerification: Joi.object({
    adminNotes: Joi.string().max(4000),
    decisionReason: Joi.string().max(2000),
  }),

  suspendSeller: Joi.object({
    suspensionReason: Joi.string().max(4000).required(),
  }),

  setCreatorAccess: Joi.object({
    accessEnabled: Joi.boolean().required(),
    reason: Joi.string().max(2000),
  }),
}

import { Router } from 'express'
import authRoutes from './auth/auth.routes'
import adminRoutes from './admin/admin.routes'
import customersRoutes from './admin/customers.routes'
import userRoutes from './users/user.routes'
import productRoutes from './products/product.routes'
import productMediaRoutes from './products/product-media.routes'
import categoryRoutes from './categories/category.routes'
import categoryMediaRoutes from './categories/category-media.routes'
import brandRoutes from './brands/brand.routes'
import productCollectionsRoutes from './collections/product-collections.routes'
import categoryCollectionsRoutes from './collections/category-collections.routes'
import orderRoutes from './orders/order.routes'
import paymentRoutes from './payments/payment.routes'
import supplierRoutes from './suppliers/supplier.routes'
import shippingRoutes from './shipping/shipping.routes'
import couponRoutes from './coupons/coupon.routes'
import reviewRoutes from './reviews/review.routes'
import notificationRoutes from './notifications/notification.routes'
import whatsappRoutes from './whatsapp/whatsapp.routes'
import emailRoutes from './emails/email.routes'
import contactRoutes from './contact/contact.routes'
import newsletterRoutes from './newsletter/newsletter.routes'
import analyticsRoutes from './analytics/analytics.routes'
import alertsRoutes from './alerts/alerts.routes'
import { blogRoutes } from './blog'
import aiRoutes from './ai/ai.routes'
import booksRoutes from './books/books.routes'
import creatorRoutes from './creator/creator.routes'
import libraryRoutes from './library/library.routes'
import adminBooksRoutes from './admin/books.routes'
import sellerRoutes from './seller/seller.routes'
import adminSellersRoutes from './admin/sellers.routes'

const router = Router()

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'TechTools API',
    version: '1.0',
    timestamp: new Date().toISOString(),
  })
})

// API routes
router.use('/auth', authRoutes)
router.use('/admin/customers', customersRoutes) // Must be before /admin to avoid /:adminId catching "customers"
router.use('/admin/sellers', adminSellersRoutes)
router.use('/admin', adminRoutes)
router.use('/admin/books', adminBooksRoutes)
router.use('/users', userRoutes)
router.use('/seller', sellerRoutes)
router.use('/products', productRoutes)
router.use('/products', productMediaRoutes) // Product media endpoints
router.use('/categories', categoryRoutes)
router.use('/categories', categoryMediaRoutes) // Category media endpoints
router.use('/brands', brandRoutes)
router.use('/collections/products', productCollectionsRoutes) // Product collections
router.use('/collections/categories', categoryCollectionsRoutes) // Category collections
router.use('/orders', orderRoutes)
router.use('/payments', paymentRoutes)
router.use('/suppliers', supplierRoutes)
router.use('/shipping', shippingRoutes)
router.use('/coupons', couponRoutes)
router.use('/reviews', reviewRoutes)
router.use('/notifications', notificationRoutes)
router.use('/whatsapp', whatsappRoutes)
router.use('/emails', emailRoutes)
router.use('/contact', contactRoutes)
router.use('/newsletter', newsletterRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/alerts', alertsRoutes)
router.use('/blog', blogRoutes)
router.use('/ai', aiRoutes)
router.use('/books', booksRoutes)
router.use('/creator', creatorRoutes)
router.use('/library', libraryRoutes)

// Documentation route
router.get('/docs', (_req, res) => {
  res.json({
    message: 'API Documentation',
    endpoints: {
      auth: {
        'POST /api/v1/auth/register': 'Register new user',
        'POST /api/v1/auth/login': 'User login',
        'POST /api/v1/auth/refresh': 'Refresh access token',
        'POST /api/v1/auth/logout': 'User logout',
      },
      users: {
        'GET /api/v1/users/profile': 'Get user profile',
        'PUT /api/v1/users/profile': 'Update user profile',
        'POST /api/v1/users/business-mode/activate':
          'Activate business mode and bootstrap creator profile (authenticated)',
        'GET /api/v1/users/addresses': 'Get user addresses',
        'POST /api/v1/users/addresses': 'Add user address',
      },
      products: {
        'GET /api/v1/products': 'Get all products',
        'GET /api/v1/products/:id': 'Get product by ID',
        'POST /api/v1/products': 'Create product (admin)',
        'PUT /api/v1/products/:id': 'Update product (admin)',
      },
      productMedia: {
        'POST /api/v1/products/:productId/media':
          'Upload product media (admin)',
        'GET /api/v1/products/:productId/media': 'Get all product media',
        'GET /api/v1/products/:productId/media/:mediaId': 'Get single media',
        'PUT /api/v1/products/:productId/media/:mediaId':
          'Update media (admin)',
        'DELETE /api/v1/products/:productId/media/:mediaId':
          'Delete media (admin)',
        'PUT /api/v1/products/:productId/media/reorder':
          'Reorder media (admin)',
        'PUT /api/v1/products/:productId/media/:mediaId/set-primary':
          'Set primary image (admin)',
      },
      categories: {
        'GET /api/v1/categories': 'Get all categories',
        'GET /api/v1/categories/:id': 'Get category by ID',
      },
      categoryMedia: {
        'POST /api/v1/categories/:categoryId/media':
          'Upload category media (admin)',
        'GET /api/v1/categories/:categoryId/media': 'Get all category media',
        'GET /api/v1/categories/:categoryId/media/:mediaId': 'Get single media',
        'PUT /api/v1/categories/:categoryId/media/:mediaId':
          'Update media (admin)',
        'DELETE /api/v1/categories/:categoryId/media/:mediaId':
          'Delete media (admin)',
      },
      productCollections: {
        'POST /api/v1/collections/products':
          'Create product collection (admin)',
        'GET /api/v1/collections/products': 'Get all product collections',
        'GET /api/v1/collections/products/:collectionId':
          'Get collection by ID',
        'PUT /api/v1/collections/products/:collectionId':
          'Update collection (admin)',
        'DELETE /api/v1/collections/products/:collectionId':
          'Delete collection (admin)',
        'POST /api/v1/collections/products/:collectionId/products':
          'Add products to collection (admin)',
        'DELETE /api/v1/collections/products/:collectionId/products/:productId':
          'Remove product (admin)',
        'PUT /api/v1/collections/products/:collectionId/products/reorder':
          'Reorder products (admin)',
      },
      categoryCollections: {
        'POST /api/v1/collections/categories':
          'Create category collection (admin)',
        'GET /api/v1/collections/categories': 'Get all category collections',
        'GET /api/v1/collections/categories/:collectionId':
          'Get collection by ID',
        'PUT /api/v1/collections/categories/:collectionId':
          'Update collection (admin)',
        'DELETE /api/v1/collections/categories/:collectionId':
          'Delete collection (admin)',
        'POST /api/v1/collections/categories/:collectionId/categories':
          'Add categories to collection (admin)',
        'DELETE /api/v1/collections/categories/:collectionId/categories/:categoryId':
          'Remove category (admin)',
        'PUT /api/v1/collections/categories/:collectionId/categories/reorder':
          'Reorder categories (admin)',
      },
      books: {
        'GET /api/v1/books': 'Get published books list',
        'GET /api/v1/books/:id': 'Get book by ID or slug',
        'GET /api/v1/books/:id/sample':
          'Get short-lived sample access URL (rate-limited)',
        'GET /api/v1/books/samples/access/:assetId?token=...':
          'Resolve sample access URL to sample asset',
      },
      creator: {
        'GET /api/v1/creator/profiles/:handle': 'Get public creator profile',
        'GET /api/v1/creator/profile/me':
          'Get own creator profile (authenticated)',
        'PUT /api/v1/creator/profile/me':
          'Create or update own creator profile (authenticated)',
        'POST /api/v1/creator/books':
          'Create a digital book product (authenticated)',
        'POST /api/v1/creator/books/:bookId/assets':
          'Upload creator book files by format (authenticated)',
        'POST /api/v1/creator/books/:bookId/submit':
          'Submit book to moderation review queue (authenticated)',
        'GET /api/v1/creator/dashboard/metrics':
          'Get creator activation and first-sale KPI metrics (authenticated)',
        'GET /api/v1/creator/dashboard/activity':
          'Get creator recent activity feed (authenticated)',
      },
      seller: {
        'GET /api/v1/seller/tiers': 'Get seller tier configuration',
        'GET /api/v1/seller/me':
          'Get current user seller profile and eligibility (authenticated)',
        'POST /api/v1/seller/onboard':
          'Create or update current user seller profile (authenticated)',
        'GET /api/v1/seller/verification-requests':
          'Get current user verification requests (authenticated)',
        'POST /api/v1/seller/verification-requests':
          'Submit seller verification request (authenticated)',
      },
      adminSellers: {
        'GET /api/v1/admin/sellers/verification-queue':
          'Get seller verification moderation queue (admin)',
        'POST /api/v1/admin/sellers/verification-requests/:requestId/approve':
          'Approve seller verification request (admin)',
        'POST /api/v1/admin/sellers/verification-requests/:requestId/reject':
          'Reject seller verification request (admin)',
        'POST /api/v1/admin/sellers/:sellerProfileId/suspend':
          'Suspend seller profile (admin)',
      },
      adminBooks: {
        'GET /api/v1/admin/books/review-queue':
          'Get moderation review queue (admin)',
        'POST /api/v1/admin/books':
          'Create admin-origin book metadata (admin/super_admin)',
        'POST /api/v1/admin/books/:bookId/assets':
          'Upload admin-origin book assets (admin/super_admin)',
        'POST /api/v1/admin/books/:bookId/submit':
          'Submit admin-origin book for moderation (admin/super_admin)',
        'POST /api/v1/admin/books/:bookId/publish':
          'Directly publish admin-origin book (super_admin)',
        'POST /api/v1/admin/books/:bookId/approve':
          'Approve or publish book (admin)',
        'POST /api/v1/admin/books/:bookId/reject': 'Reject book (admin)',
      },
      library: {
        'GET /api/v1/library/me':
          'Get current user digital library (authenticated)',
        'GET /api/v1/library/me/:productId/access-url':
          'Get signed access URL for entitled book (authenticated)',
        'GET /api/v1/library/access/:assetId?token=...':
          'Resolve signed access URL to digital asset',
        'PUT /api/v1/library/me/:productId/progress':
          'Update reading progress (authenticated)',
      },
    },
  })
})

export default router

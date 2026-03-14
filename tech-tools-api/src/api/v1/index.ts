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
import whatsappRoutes from './whatsapp/whatsapp.routes'
import emailRoutes from './emails/email.routes'
import contactRoutes from './contact/contact.routes'
import { blogRoutes } from './blog'

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
router.use('/admin', adminRoutes)
router.use('/users', userRoutes)
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
router.use('/whatsapp', whatsappRoutes)
router.use('/emails', emailRoutes)
router.use('/contact', contactRoutes)
router.use('/blog', blogRoutes)

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
    },
  })
})

export default router

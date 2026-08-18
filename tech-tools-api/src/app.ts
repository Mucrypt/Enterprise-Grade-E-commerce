import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'

import v1Router from './api/v1'
import errorHandler from './middleware/errorHandler'
import { notFoundHandler } from './middleware/notFoundHandler'
import logger from './utils/logger'
import { corsOptionsDelegate } from './config/cors.config'

const app: Application = express()

// Trust proxy for rate limiting behind nginx/cloudflare
// Using 1 instead of true to specify exactly one proxy (nginx) in front
app.set('trust proxy', 1)

// Swagger documentation (disabled for now)
// const swaggerDocument = YAML.load('./swagger.yaml')

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        mediaSrc: ["'self'", 'data:', 'https:', 'http:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

// CORS configuration -- decision logic lives in config/cors.config.ts
// (see its header comment for why SOURCING-1's two extension-facing
// routes need a different policy than every other route).
app.use(cors(corsOptionsDelegate))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable validation warnings in production
})
app.use('/api/', limiter)

// Compression
app.use(compression())

// Body parsers
// Stripe webhook signature verification needs the exact raw request bytes,
// but the global JSON parser below runs before Express even routes to that
// handler, so the raw stream is gone by the time it would matter. Capture it
// here as a side channel (req.rawBody) so the webhook route doesn't need its
// own body parser ahead of this one -- see payment.controller.ts handleWebhook.
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      ;(req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf)
    },
  }),
)
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Static file serving for media uploads
const uploadsDir = process.env.UPLOAD_DIR || 'uploads'
app.use(
  '/media',
  express.static(path.join(__dirname, '..', uploadsDir), {
    maxAge: '1y', // Cache for 1 year
    etag: true,
    lastModified: true,
  }),
)

// Request logging
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
  }),
)

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  })
})

// API Documentation (disabled for now - create swagger.yaml to enable)
// app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// API Routes
app.use('/api/v1', v1Router)

// 404 handler
app.use(notFoundHandler)

// Error handler (must be last)
app.use(errorHandler)

export default app

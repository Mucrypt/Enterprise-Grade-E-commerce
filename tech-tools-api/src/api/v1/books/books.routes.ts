import { Router } from 'express'
import {
	getBookById,
	getBooks,
	getBookSampleAccess,
	resolveBookSampleAccess,
} from './books.controller'
import rateLimit from 'express-rate-limit'

const router = Router()

const sampleReadLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		error: 'Too many sample requests. Please try again shortly.',
	},
})

router.get('/', getBooks)
router.get('/samples/access/:assetId', sampleReadLimiter, resolveBookSampleAccess)
router.get('/:id/sample', sampleReadLimiter, getBookSampleAccess)
router.get('/:id', getBookById)

export default router
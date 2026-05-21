import { Router } from 'express'
import { getBookById, getBooks } from './books.controller'

const router = Router()

router.get('/', getBooks)
router.get('/:id', getBookById)

export default router
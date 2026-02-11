import { Router } from 'express'
import {
  register,
  login,
  logout,
  me,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from './auth.controller'
import { validate } from '../../../middleware/validation'
import { authSchemas } from '../../../middleware/validation'
import {
  authenticate,
  refreshToken as refreshAccessToken,
} from '../../../middleware/auth'

const router = Router()

router.post('/register', validate(authSchemas.register), register)
router.post('/login', validate(authSchemas.login), login)
router.get('/me', authenticate, me)
router.post('/refresh', refreshAccessToken)
router.post('/logout', logout)
router.post('/verify-email', verifyEmail)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

export default router

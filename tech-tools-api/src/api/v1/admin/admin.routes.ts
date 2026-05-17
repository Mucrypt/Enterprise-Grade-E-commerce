import { Router } from 'express'
import {
  inviteAdmin,
  acceptInvitation,
  getAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  getAdminActivityLogs,
  getAdminPermissions,
} from './admin.controller'
import { unlockUserAccount, getLockedAccounts } from './lockout.routes'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// =====================================================
// Public Routes (No Auth Required)
// =====================================================

// Accept admin invitation (public - uses token)
router.post('/invitations/accept', acceptInvitation)

// =====================================================
// Super Admin Only Routes
// =====================================================

router.use(authenticate, authorize('super_admin'))

// Admin Invitation Management
router.post('/invite', inviteAdmin)

// Admin User Management
router.get('/', getAdmins)
router.get('/:adminId', getAdminById)
router.put('/:adminId', updateAdmin)
router.delete('/:adminId', deleteAdmin)

// Activity Logs
router.get('/logs/activity', getAdminActivityLogs)

// Permissions
router.get('/permissions/:role', getAdminPermissions)

// Account Lockout Management
router.get('/locked-accounts', getLockedAccounts)
router.post('/unlock-account', unlockUserAccount)

export default router

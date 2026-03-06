import { Router } from 'express'
import {
  getCustomers,
  getCustomerStats,
  getCustomerById,
  updateCustomerStatus,
  deleteCustomer,
} from './customers.controller'
import { authenticate, authorize } from '../../../middleware/auth'

const router = Router()

// All routes require admin authentication
router.use(authenticate, authorize('admin', 'super_admin'))

// Customer statistics
router.get('/stats', getCustomerStats)

// Customer list with search/filter/pagination
router.get('/', getCustomers)

// Single customer details
router.get('/:customerId', getCustomerById)

// Update customer status (activate/deactivate)
router.patch('/:customerId/status', updateCustomerStatus)

// Delete customer
router.delete('/:customerId', deleteCustomer)

export default router

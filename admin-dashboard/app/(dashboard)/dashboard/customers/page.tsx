'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  customerService,
  type Customer,
  type CustomerStats,
  type AccountType,
} from '@/services/customer.service'
import { useDebounce } from '@/hooks/useDebounce'

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  customer: 'Customers',
  admin: 'Admins',
  super_admin: 'Super Admins',
  all: 'All Accounts',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>(
    '',
  )
  const [userTypeFilter, setUserTypeFilter] = useState<AccountType>('customer')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  )
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  // Deactivation also asks for a reason (recorded in the admin activity
  // log) -- previously this was an instant, untraced toggle.
  const [deactivateTarget, setDeactivateTarget] = useState<Customer | null>(
    null,
  )
  const [reasonText, setReasonText] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const response = await customerService.getStats(userTypeFilter)
      if (response.success && response.data) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }, [userTypeFilter])

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await customerService.getCustomers({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        status: statusFilter,
        userType: userTypeFilter,
        sortBy: 'created_at',
        sortOrder: 'DESC',
      })

      if (response.success) {
        setCustomers(response.data.customers)
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
        }))
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      setLoading(false)
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    statusFilter,
    userTypeFilter,
  ])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleActivate = async (customer: Customer) => {
    try {
      setActionLoading(true)
      await customerService.updateCustomerStatus(customer.id, true)
      fetchCustomers()
      fetchStats()
    } catch (error) {
      console.error('Failed to update account status:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return

    try {
      setActionLoading(true)
      await customerService.updateCustomerStatus(
        deactivateTarget.id,
        false,
        reasonText || undefined,
      )
      setDeactivateTarget(null)
      setReasonText('')
      fetchCustomers()
      fetchStats()
    } catch (error) {
      console.error('Failed to update account status:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return

    try {
      setActionLoading(true)
      await customerService.deleteCustomer(
        selectedCustomer.id,
        reasonText || undefined,
      )
      setShowDeleteDialog(false)
      setSelectedCustomer(null)
      setReasonText('')
      fetchCustomers()
      fetchStats()
    } catch (error) {
      console.error('Failed to delete customer:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Customers</h1>
          <p className='text-muted-foreground'>Manage your customer base</p>
        </div>
        <Button
          onClick={() => {
            fetchCustomers()
            fetchStats()
          }}
          variant='outline'
        >
          <RefreshCw className='h-4 w-4 mr-2' />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total {ACCOUNT_TYPE_LABELS[userTypeFilter]}
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-8 w-16' />
            ) : (
              <div className='text-2xl font-bold'>{stats?.total || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Active</CardTitle>
            <UserCheck className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-8 w-16' />
            ) : (
              <div className='text-2xl font-bold text-green-600'>
                {stats?.active || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Inactive</CardTitle>
            <UserX className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-8 w-16' />
            ) : (
              <div className='text-2xl font-bold text-red-600'>
                {stats?.inactive || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>
              New This Month
            </CardTitle>
            <UserPlus className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className='h-8 w-16' />
            ) : (
              <div className='text-2xl font-bold text-blue-600'>
                {stats?.newThisMonth || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className='flex flex-col sm:flex-row gap-4'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search by name, email, or phone...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-9'
          />
        </div>
        <Select
          value={userTypeFilter}
          onValueChange={(value: string) => {
            setUserTypeFilter(value as AccountType)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
        >
          <SelectTrigger className='w-45'>
            <SelectValue placeholder='Account type' />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(
              (type) => (
                <SelectItem key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <div className='flex gap-2'>
          <Button
            variant={statusFilter === '' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('')}
            size='sm'
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('active')}
            size='sm'
          >
            Active
          </Button>
          <Button
            variant={statusFilter === 'inactive' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('inactive')}
            size='sm'
          >
            Inactive
          </Button>
        </div>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='space-y-3'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className='text-center py-12'>
              <Users className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No accounts found</h3>
              <p className='text-muted-foreground'>
                {searchQuery || statusFilter
                  ? 'Try adjusting your search or filters'
                  : 'Customers will appear here when they register'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className='w-17.7'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className='font-medium'>{customer.fullName}</div>
                          <div className='text-sm text-muted-foreground flex items-center gap-1'>
                            <Mail className='h-3 w-3' />
                            {customer.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.phone ? (
                          <div className='flex items-center gap-1 text-sm'>
                            <Phone className='h-3 w-3' />
                            {customer.phone}
                          </div>
                        ) : (
                          <span className='text-muted-foreground text-sm'>
                            No phone
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='capitalize'>
                          {customer.userType?.replace('_', ' ') || 'customer'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={customer.isActive ? 'default' : 'secondary'}
                        >
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {customer.emailVerified && (
                          <Badge variant='outline' className='ml-1'>
                            Verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <ShoppingBag className='h-3 w-3 text-muted-foreground' />
                          {customer.orderCount || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <DollarSign className='h-3 w-3 text-muted-foreground' />
                          {formatCurrency(customer.totalSpent || 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                          <Calendar className='h-3 w-3' />
                          {formatDate(customer.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() =>
                                customer.isActive
                                  ? setDeactivateTarget(customer)
                                  : handleActivate(customer)
                              }
                              disabled={actionLoading}
                            >
                              {customer.isActive ? (
                                <>
                                  <UserX className='h-4 w-4 mr-2' />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className='h-4 w-4 mr-2' />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setShowDeleteDialog(true)
                              }}
                              className='text-red-600'
                            >
                              <UserX className='h-4 w-4 mr-2' />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {customers.length} of {pagination.total} customers
                  </p>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page - 1,
                        }))
                      }
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                    <span className='text-sm'>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page + 1,
                        }))
                      }
                      disabled={pagination.page === pagination.totalPages}
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open: boolean) => {
          setShowDeleteDialog(open)
          if (!open) setReasonText('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCustomer?.fullName}
              &apos;s account ({selectedCustomer?.userType || 'customer'})?
              This deactivates the account and marks it deleted -- it can be
              recovered from the database if needed, but will no longer be
              able to sign in or appear in this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='px-6 pb-2'>
            <label className='text-sm font-medium mb-1.5 block'>
              Reason (recorded in the admin activity log)
            </label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder='e.g. Fraudulent orders, repeated policy violations...'
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCustomer}
              className='bg-red-600 hover:bg-red-700'
              disabled={actionLoading}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeactivateTarget(null)
            setReasonText('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.fullName} ({deactivateTarget?.userType || 'customer'})
              will no longer be able to sign in until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='px-6 pb-2'>
            <label className='text-sm font-medium mb-1.5 block'>
              Reason (recorded in the admin activity log)
            </label>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder='e.g. Suspicious activity under review...'
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className='bg-amber-600 hover:bg-amber-700'
              disabled={actionLoading}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { toast } from 'sonner'
import {
  Package,
  Clock,
  CheckCircle,
  TruckIcon,
  Search,
  Download,
  MoreHorizontal,
  Eye,
  RefreshCw,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CreditCard,
  DollarSign,
  ShoppingCart,
  Calendar,
  X,
  Columns,
  Printer,
  Mail,
  MapPin,
  FileText,
  Undo2,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { orderService, Order, OrderFilters } from '@/services/order.service'

// Order status config with colors and icons
const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    color:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: CheckCircle,
  },
  processing: {
    label: 'Processing',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: RefreshCw,
  },
  ready_to_ship: {
    label: 'Ready to Ship',
    color:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    icon: PackageCheck,
  },
  shipped: {
    label: 'Shipped',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    icon: TruckIcon,
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: Package,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: XCircle,
  },
  refunded: {
    label: 'Refunded',
    color:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: Undo2,
  },
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> =
  {
    pending: {
      label: 'Pending',
      color:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    authorized: {
      label: 'Authorized',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    paid: {
      label: 'Paid',
      color:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    partially_refunded: {
      label: 'Partial Refund',
      color:
        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    refunded: {
      label: 'Refunded',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    },
    failed: {
      label: 'Failed',
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
  }

// Date filter presets
const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
]

export default function OrdersPage() {
  const queryClient = useQueryClient()

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    orderNumber: true,
    customer: true,
    items: true,
    total: true,
    orderStatus: true,
    paymentStatus: true,
    paymentMethod: true,
    date: true,
    actions: true,
  })

  // Dialogs
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] = useState(false)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')

  // Calculate date range based on preset
  const getDateRange = useCallback((preset: string) => {
    const now = new Date()
    switch (preset) {
      case 'today':
        return {
          startDate: startOfDay(now).toISOString(),
          endDate: endOfDay(now).toISOString(),
        }
      case 'yesterday':
        const yesterday = subDays(now, 1)
        return {
          startDate: startOfDay(yesterday).toISOString(),
          endDate: endOfDay(yesterday).toISOString(),
        }
      case '7days':
        return {
          startDate: subDays(now, 7).toISOString(),
          endDate: now.toISOString(),
        }
      case '30days':
        return {
          startDate: subDays(now, 30).toISOString(),
          endDate: now.toISOString(),
        }
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        return {
          startDate: startOfMonth.toISOString(),
          endDate: now.toISOString(),
        }
      default:
        return {}
    }
  }, [])

  // Build filters
  const filters: OrderFilters = useMemo(() => {
    const dateRange = getDateRange(dateFilter)
    return {
      page,
      limit: pageSize,
      search: searchQuery || undefined,
      orderStatus: orderStatusFilter !== 'all' ? orderStatusFilter : undefined,
      paymentStatus:
        paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
      sortBy,
      sortOrder,
      ...dateRange,
    }
  }, [
    page,
    pageSize,
    searchQuery,
    orderStatusFilter,
    paymentStatusFilter,
    dateFilter,
    sortBy,
    sortOrder,
    getDateRange,
  ])

  // Fetch orders
  const {
    data: ordersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => orderService.getOrders(filters),
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['orderStats'],
    queryFn: () => orderService.getStats(),
  })

  const orders = ordersData?.data?.orders || []
  const pagination = ordersData?.data?.pagination
  const stats = statsData?.data?.stats

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string
      status: string
      notes?: string
    }) => orderService.updateStatus(id, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orderStats'] })
      setIsStatusDialogOpen(false)
      setSelectedOrder(null)
      setNewStatus('')
      setStatusNote('')
      toast.success('Order status updated')
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(
        error.response?.data?.error || 'Failed to update order status',
      )
    },
  })

  // Bulk update status mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: ({
      orderIds,
      status,
      notes,
    }: {
      orderIds: string[]
      status: string
      notes?: string
    }) => orderService.bulkUpdateStatus(orderIds, status, notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orderStats'] })
      setIsBulkStatusDialogOpen(false)
      setSelectedOrders([])
      setNewStatus('')
      setStatusNote('')
      toast.success(`${data.data?.updatedCount || 0} orders updated`)
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to update orders')
    },
  })

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedOrders(orders.map((o: Order) => o.id))
      } else {
        setSelectedOrders([])
      }
    },
    [orders],
  )

  const handleSelectOrder = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders((prev) => [...prev, id])
    } else {
      setSelectedOrders((prev) => prev.filter((i) => i !== id))
    }
  }, [])

  // Sort handler
  const handleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(column)
        setSortOrder('desc')
      }
    },
    [sortBy],
  )

  // Open status change dialog
  const openStatusDialog = useCallback((order: Order) => {
    setSelectedOrder(order)
    setNewStatus(order.order_status)
    setIsStatusDialogOpen(true)
  }, [])

  // Open order details
  const openOrderDetails = useCallback((order: Order) => {
    setSelectedOrder(order)
    setIsOrderDetailsOpen(true)
  }, [])

  // Export handler
  const handleExport = async (exportFormat: 'json' | 'csv') => {
    try {
      const dateRange = getDateRange(dateFilter)
      const result = await orderService.exportOrders({
        ...dateRange,
        orderStatus:
          orderStatusFilter !== 'all' ? orderStatusFilter : undefined,
        format: exportFormat,
      })

      if (exportFormat === 'csv' && result instanceof Blob) {
        const url = URL.createObjectURL(result)
        const a = document.createElement('a')
        a.href = url
        a.download = `orders-export-${
          new Date().toISOString().split('T')[0]
        }.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Orders exported successfully')
      } else {
        // JSON export - download as file
        const blob = new Blob([JSON.stringify(result, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orders-export-${
          new Date().toISOString().split('T')[0]
        }.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Orders exported successfully')
      }
      setIsExportDialogOpen(false)
    } catch {
      toast.error('Failed to export orders')
    }
  }

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className='h-4 w-4 ml-1' />
    return sortOrder === 'asc' ? (
      <ArrowUp className='h-4 w-4 ml-1' />
    ) : (
      <ArrowDown className='h-4 w-4 ml-1' />
    )
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('')
    setOrderStatusFilter('all')
    setPaymentStatusFilter('all')
    setDateFilter('all')
    setPage(1)
  }

  const hasActiveFilters =
    searchQuery ||
    orderStatusFilter !== 'all' ||
    paymentStatusFilter !== 'all' ||
    dateFilter !== 'all'

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Orders</h1>
          <p className='text-muted-foreground'>
            Manage and track customer orders
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={() => setIsExportDialogOpen(true)}>
            <Download className='h-4 w-4 mr-2' />
            Export
          </Button>
          <Button
            variant='outline'
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['orders'] })
            }
          >
            <RefreshCw className='h-4 w-4 mr-2' />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Orders</CardTitle>
            <ShoppingCart className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.totalOrders || 0}</div>
            <p className='text-xs text-muted-foreground'>
              {stats?.todayOrders || 0} today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Revenue</CardTitle>
            <DollarSign className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className='text-xs text-muted-foreground'>
              {formatCurrency(stats?.todayRevenue || 0)} today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Pending</CardTitle>
            <Clock className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.statusCounts?.pending || 0}
            </div>
            <p className='text-xs text-muted-foreground'>
              Awaiting confirmation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Processing</CardTitle>
            <RefreshCw className='h-4 w-4 text-purple-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(stats?.statusCounts?.processing || 0) +
                (stats?.statusCounts?.ready_to_ship || 0)}
            </div>
            <p className='text-xs text-muted-foreground'>Being prepared</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>
              Avg Order Value
            </CardTitle>
            <CreditCard className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {formatCurrency(stats?.averageOrderValue || 0)}
            </div>
            <p className='text-xs text-muted-foreground'>Per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-wrap items-center gap-4'>
            {/* Search */}
            <div className='relative flex-1 min-w-62.5'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search by order #, customer email, or name...'
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className='pl-10'
              />
            </div>

            {/* Order Status Filter */}
            <Select
              value={orderStatusFilter}
              onValueChange={(v: string) => {
                setOrderStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='w-40'>
                <Package className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Order Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Statuses</SelectItem>
                {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Payment Status Filter */}
            <Select
              value={paymentStatusFilter}
              onValueChange={(v: string) => {
                setPaymentStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='w-40'>
                <CreditCard className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Payment Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Payments</SelectItem>
                {Object.entries(PAYMENT_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select
              value={dateFilter}
              onValueChange={(v: string) => {
                setDateFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className='w-37.5'>
                <Calendar className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Date Range' />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Column Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm'>
                  <Columns className='h-4 w-4 mr-2' />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-50'>
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(visibleColumns).map(([key, value]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={value}
                    onCheckedChange={(checked: boolean) =>
                      setVisibleColumns((prev) => ({ ...prev, [key]: checked }))
                    }
                  >
                    {key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase())}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant='ghost' size='sm' onClick={clearFilters}>
                <X className='h-4 w-4 mr-1' />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedOrders.length > 0 && (
            <div className='mt-4 p-3 bg-muted rounded-lg flex items-center justify-between'>
              <span className='text-sm font-medium'>
                {selectedOrders.length} order
                {selectedOrders.length > 1 ? 's' : ''} selected
              </span>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setIsBulkStatusDialogOpen(true)}
                >
                  <RefreshCw className='h-4 w-4 mr-2' />
                  Update Status
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setSelectedOrders([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className='p-0'>
          {isLoading ? (
            <div className='p-8 space-y-4'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : error ? (
            <div className='p-8 text-center'>
              <AlertTriangle className='h-12 w-12 mx-auto text-yellow-500 mb-4' />
              <p className='text-lg font-medium'>Failed to load orders</p>
              <p className='text-muted-foreground'>Please try again later</p>
            </div>
          ) : orders.length === 0 ? (
            <div className='p-8 text-center'>
              <Package className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <p className='text-lg font-medium'>No orders found</p>
              <p className='text-muted-foreground'>
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Orders will appear here when customers make purchases'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12.5'>
                    <Checkbox
                      checked={
                        selectedOrders.length === orders.length &&
                        orders.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  {visibleColumns.orderNumber && (
                    <TableHead
                      className='cursor-pointer'
                      onClick={() => handleSort('order_number')}
                    >
                      <div className='flex items-center'>
                        Order #{getSortIcon('order_number')}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.customer && <TableHead>Customer</TableHead>}
                  {visibleColumns.items && (
                    <TableHead className='text-center'>Items</TableHead>
                  )}
                  {visibleColumns.total && (
                    <TableHead
                      className='cursor-pointer'
                      onClick={() => handleSort('grand_total')}
                    >
                      <div className='flex items-center'>
                        Total
                        {getSortIcon('grand_total')}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.orderStatus && (
                    <TableHead
                      className='cursor-pointer'
                      onClick={() => handleSort('order_status')}
                    >
                      <div className='flex items-center'>
                        Status
                        {getSortIcon('order_status')}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.paymentStatus && (
                    <TableHead
                      className='cursor-pointer'
                      onClick={() => handleSort('payment_status')}
                    >
                      <div className='flex items-center'>
                        Payment
                        {getSortIcon('payment_status')}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.paymentMethod && (
                    <TableHead>Method</TableHead>
                  )}
                  {visibleColumns.date && (
                    <TableHead
                      className='cursor-pointer'
                      onClick={() => handleSort('created_at')}
                    >
                      <div className='flex items-center'>
                        Date
                        {getSortIcon('created_at')}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.actions && (
                    <TableHead className='text-right'>Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: Order) => {
                  const statusConfig =
                    ORDER_STATUS_CONFIG[order.order_status] ||
                    ORDER_STATUS_CONFIG.pending
                  const paymentConfig =
                    PAYMENT_STATUS_CONFIG[order.payment_status] ||
                    PAYMENT_STATUS_CONFIG.pending
                  const StatusIcon = statusConfig.icon

                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked: boolean) =>
                            handleSelectOrder(order.id, checked)
                          }
                        />
                      </TableCell>
                      {visibleColumns.orderNumber && (
                        <TableCell>
                          <button
                            onClick={() => openOrderDetails(order)}
                            className='font-medium text-primary hover:underline'
                          >
                            {order.order_number}
                          </button>
                        </TableCell>
                      )}
                      {visibleColumns.customer && (
                        <TableCell>
                          <div>
                            <p className='font-medium'>
                              {order.customer_first_name &&
                              order.customer_last_name
                                ? `${order.customer_first_name} ${order.customer_last_name}`
                                : 'Guest'}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              {order.customer_email || 'No email'}
                            </p>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.items && (
                        <TableCell className='text-center'>
                          <Badge variant='secondary'>
                            {order.item_count || 0}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.total && (
                        <TableCell className='font-medium'>
                          {formatCurrency(order.grand_total, order.currency)}
                        </TableCell>
                      )}
                      {visibleColumns.orderStatus && (
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className='h-3 w-3 mr-1' />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.paymentStatus && (
                        <TableCell>
                          <Badge className={paymentConfig.color}>
                            {paymentConfig.label}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.paymentMethod && (
                        <TableCell>
                          <span className='text-sm capitalize'>
                            {order.payment_method || '-'}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.date && (
                        <TableCell>
                          <div>
                            <p className='text-sm'>
                              {format(
                                new Date(order.created_at),
                                'MMM d, yyyy',
                              )}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {format(new Date(order.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.actions && (
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon'>
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem
                                onClick={() => openOrderDetails(order)}
                              >
                                <Eye className='h-4 w-4 mr-2' />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <RefreshCw className='h-4 w-4 mr-2' />
                                  Update Status
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {Object.entries(ORDER_STATUS_CONFIG).map(
                                    ([key, config]) => {
                                      const ConfigIcon = config.icon
                                      return (
                                        <DropdownMenuItem
                                          key={key}
                                          onClick={() => {
                                            setSelectedOrder(order)
                                            setNewStatus(key)
                                            setIsStatusDialogOpen(true)
                                          }}
                                          disabled={order.order_status === key}
                                        >
                                          <ConfigIcon className='h-4 w-4 mr-2' />
                                          {config.label}
                                        </DropdownMenuItem>
                                      )
                                    },
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Printer className='h-4 w-4 mr-2' />
                                Print Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className='h-4 w-4 mr-2' />
                                Send Email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className='border-t p-4 flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-muted-foreground'>
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, pagination.total)} of{' '}
                {pagination.total}
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v: string) => {
                  setPageSize(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className='w-25'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>10 / page</SelectItem>
                  <SelectItem value='20'>20 / page</SelectItem>
                  <SelectItem value='50'>50 / page</SelectItem>
                  <SelectItem value='100'>100 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className='text-sm px-2'>
                Page {page} of {pagination.totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Change the status for order {selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>New Status</Label>
              <Select
                value={newStatus}
                onValueChange={(v: string) => setNewStatus(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => {
                    const ConfigIcon = config.icon
                    return (
                      <SelectItem key={key} value={key}>
                        <div className='flex items-center'>
                          <ConfigIcon className='h-4 w-4 mr-2' />
                          {config.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Internal Note (Optional)</Label>
              <Textarea
                placeholder='Add a note about this status change...'
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedOrder && newStatus) {
                  updateStatusMutation.mutate({
                    id: selectedOrder.id,
                    status: newStatus,
                    notes: statusNote || undefined,
                  })
                }
              }}
              disabled={updateStatusMutation.isPending || !newStatus}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog
        open={isBulkStatusDialogOpen}
        onOpenChange={setIsBulkStatusDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Status</DialogTitle>
            <DialogDescription>
              Update status for {selectedOrders.length} selected orders
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>New Status</Label>
              <Select
                value={newStatus}
                onValueChange={(v: string) => setNewStatus(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => {
                    const ConfigIcon = config.icon
                    return (
                      <SelectItem key={key} value={key}>
                        <div className='flex items-center'>
                          <ConfigIcon className='h-4 w-4 mr-2' />
                          {config.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Internal Note (Optional)</Label>
              <Textarea
                placeholder='Add a note about this bulk status change...'
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsBulkStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newStatus) {
                  bulkUpdateMutation.mutate({
                    orderIds: selectedOrders,
                    status: newStatus,
                    notes: statusNote || undefined,
                  })
                }
              }}
              disabled={bulkUpdateMutation.isPending || !newStatus}
            >
              {bulkUpdateMutation.isPending
                ? 'Updating...'
                : `Update ${selectedOrders.length} Orders`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Orders</DialogTitle>
            <DialogDescription>
              Choose export format and download order data
            </DialogDescription>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-4 py-4'>
            <Button
              variant='outline'
              className='h-24 flex flex-col items-center justify-center gap-2'
              onClick={() => handleExport('csv')}
            >
              <FileText className='h-8 w-8' />
              <span>Export as CSV</span>
            </Button>
            <Button
              variant='outline'
              className='h-24 flex flex-col items-center justify-center gap-2'
              onClick={() => handleExport('json')}
            >
              <FileText className='h-8 w-8' />
              <span>Export as JSON</span>
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsExportDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent className='max-w-4xl max-h-[90vh]'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              Order {selectedOrder?.order_number}
              {selectedOrder && (
                <Badge
                  className={
                    ORDER_STATUS_CONFIG[selectedOrder.order_status]?.color
                  }
                >
                  {ORDER_STATUS_CONFIG[selectedOrder.order_status]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className='max-h-[70vh]'>
            {selectedOrder && (
              <div className='space-y-6 pr-4'>
                {/* Order Summary */}
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>Order Date</p>
                    <p className='font-medium'>
                      {format(new Date(selectedOrder.created_at), 'PPP')}
                    </p>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>Grand Total</p>
                    <p className='font-medium text-lg'>
                      {formatCurrency(
                        selectedOrder.grand_total,
                        selectedOrder.currency,
                      )}
                    </p>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>
                      Payment Status
                    </p>
                    <Badge
                      className={
                        PAYMENT_STATUS_CONFIG[selectedOrder.payment_status]
                          ?.color
                      }
                    >
                      {
                        PAYMENT_STATUS_CONFIG[selectedOrder.payment_status]
                          ?.label
                      }
                    </Badge>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>
                      Payment Method
                    </p>
                    <p className='font-medium capitalize'>
                      {selectedOrder.payment_method || '-'}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Customer Info */}
                <div>
                  <h3 className='font-semibold mb-3 flex items-center gap-2'>
                    <MapPin className='h-4 w-4' />
                    Customer & Shipping
                  </h3>
                  <div className='grid md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <p className='text-sm font-medium'>Customer</p>
                      <div className='text-sm text-muted-foreground'>
                        <p>
                          {selectedOrder.customer_first_name}{' '}
                          {selectedOrder.customer_last_name}
                        </p>
                        <p>{selectedOrder.customer_email}</p>
                        {selectedOrder.customer_phone && (
                          <p>{selectedOrder.customer_phone}</p>
                        )}
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <p className='text-sm font-medium'>Shipping Address</p>
                      <div className='text-sm text-muted-foreground'>
                        <p>
                          {selectedOrder.shipping_address?.first_name}{' '}
                          {selectedOrder.shipping_address?.last_name}
                        </p>
                        {selectedOrder.shipping_address?.company && (
                          <p>{selectedOrder.shipping_address.company}</p>
                        )}
                        <p>{selectedOrder.shipping_address?.address_line_1}</p>
                        {selectedOrder.shipping_address?.address_line_2 && (
                          <p>{selectedOrder.shipping_address.address_line_2}</p>
                        )}
                        <p>
                          {selectedOrder.shipping_address?.city},{' '}
                          {selectedOrder.shipping_address?.state}{' '}
                          {selectedOrder.shipping_address?.postal_code}
                        </p>
                        <p>{selectedOrder.shipping_address?.country}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Order Summary */}
                <div>
                  <h3 className='font-semibold mb-3'>Order Summary</h3>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span>Subtotal</span>
                      <span>
                        {formatCurrency(
                          selectedOrder.total_amount,
                          selectedOrder.currency,
                        )}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Shipping</span>
                      <span>
                        {formatCurrency(
                          selectedOrder.shipping_amount,
                          selectedOrder.currency,
                        )}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Tax</span>
                      <span>
                        {formatCurrency(
                          selectedOrder.tax_amount,
                          selectedOrder.currency,
                        )}
                      </span>
                    </div>
                    {selectedOrder.discount_amount > 0 && (
                      <div className='flex justify-between text-green-600'>
                        <span>Discount</span>
                        <span>
                          -
                          {formatCurrency(
                            selectedOrder.discount_amount,
                            selectedOrder.currency,
                          )}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className='flex justify-between font-medium text-lg'>
                      <span>Grand Total</span>
                      <span>
                        {formatCurrency(
                          selectedOrder.grand_total,
                          selectedOrder.currency,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {(selectedOrder.customer_notes ||
                  selectedOrder.internal_notes) && (
                  <>
                    <Separator />
                    <div className='grid md:grid-cols-2 gap-4'>
                      {selectedOrder.customer_notes && (
                        <div>
                          <p className='text-sm font-medium mb-1'>
                            Customer Notes
                          </p>
                          <p className='text-sm text-muted-foreground bg-muted p-3 rounded'>
                            {selectedOrder.customer_notes}
                          </p>
                        </div>
                      )}
                      {selectedOrder.internal_notes && (
                        <div>
                          <p className='text-sm font-medium mb-1'>
                            Internal Notes
                          </p>
                          <pre className='text-sm text-muted-foreground bg-muted p-3 rounded whitespace-pre-wrap font-sans'>
                            {selectedOrder.internal_notes}
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => selectedOrder && openStatusDialog(selectedOrder)}
            >
              <RefreshCw className='h-4 w-4 mr-2' />
              Update Status
            </Button>
            <Button onClick={() => setIsOrderDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

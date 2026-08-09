'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Tag,
  Search,
  Plus,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit,
  RefreshCw,
  Percent,
  DollarSign,
  Truck,
  Gift,
  Calendar,
  Users,
  ShoppingCart,
  TrendingUp,
  XCircle,
  CheckCircle,
  Clock,
  Download,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import apiClient from '@/lib/api-client'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'

// Types
interface Coupon {
  id: string
  code: string
  name: string
  description: string | null
  coupon_type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y'
  discount_value: number
  minimum_order_amount: number | null
  maximum_discount: number | null
  usage_limit: number | null
  usage_per_user: number | null
  usage_count: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  is_first_order_only: boolean
  applicable_product_ids: string[] | null
  applicable_category_ids: string[] | null
  excluded_product_ids: string[] | null
  buy_quantity: number | null
  get_quantity: number | null
  status: 'active' | 'inactive' | 'expired' | 'scheduled'
  created_at: string
}

interface CouponStats {
  totalCoupons: number
  activeCoupons: number
  expiredCoupons: number
  totalUsage: number
  totalDiscount: number
  topCoupons: { code: string; usage_count: number; total_discount: number }[]
}

interface CouponFilters {
  search: string
  status: string
  type: string
  page: number
  limit: number
}

// Status badge config
const STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  active: { label: 'Active', variant: 'default' },
  scheduled: { label: 'Scheduled', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'destructive' },
  inactive: { label: 'Inactive', variant: 'outline' },
}

// Coupon type icons
const TYPE_ICONS: Record<string, typeof Percent> = {
  percentage: Percent,
  fixed_amount: DollarSign,
  free_shipping: Truck,
  buy_x_get_y: Gift,
}

export default function CouponsPage() {
  return (
    <RequirePagePermission permission='marketing.view'>
      <CouponsPageContent />
    </RequirePagePermission>
  )
}

function CouponsPageContent() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<CouponFilters>({
    search: '',
    status: 'all',
    type: 'all',
    page: 1,
    limit: 20,
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)

  // Form state for create/edit
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    couponType: 'percentage' as Coupon['coupon_type'],
    discountValue: 0,
    minimumOrderAmount: '',
    maximumDiscount: '',
    usageLimit: '',
    usagePerUser: '',
    validFrom: '',
    validUntil: '',
    isActive: true,
    isFirstOrderOnly: false,
    buyQuantity: '',
    getQuantity: '',
  })

  // Generate form state
  const [generateData, setGenerateData] = useState({
    prefix: '',
    count: 10,
    couponType: 'percentage' as Coupon['coupon_type'],
    discountValue: 10,
    usageLimit: 1,
    validDays: 30,
  })

  // Fetch coupons
  const { data: couponsData, isLoading: couponsLoading } = useQuery({
    queryKey: ['coupons', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.type !== 'all') params.append('type', filters.type)
      params.append('page', filters.page.toString())
      params.append('limit', filters.limit.toString())

      const response = await apiClient.get<{
        coupons: Coupon[]
        total: number
        page: number
        limit: number
      }>(`/coupons?${params.toString()}`)
      return response
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['coupon-stats'],
    queryFn: async () => {
      const response = await apiClient.get<CouponStats>('/coupons/stats')
      return response
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description || null,
        couponType: data.couponType,
        discountValue: data.discountValue,
        minimumOrderAmount: data.minimumOrderAmount
          ? parseFloat(data.minimumOrderAmount)
          : null,
        maximumDiscount: data.maximumDiscount
          ? parseFloat(data.maximumDiscount)
          : null,
        usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
        usagePerUser: data.usagePerUser ? parseInt(data.usagePerUser) : null,
        validFrom: data.validFrom || null,
        validUntil: data.validUntil || null,
        isActive: data.isActive,
        isFirstOrderOnly: data.isFirstOrderOnly,
        buyQuantity: data.buyQuantity ? parseInt(data.buyQuantity) : null,
        getQuantity: data.getQuantity ? parseInt(data.getQuantity) : null,
      }
      const response = await apiClient.post<Coupon>('/coupons', payload)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      queryClient.invalidateQueries({ queryKey: ['coupon-stats'] })
      toast.success('Coupon created successfully')
      setIsCreateDialogOpen(false)
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create coupon')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const payload = {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description || null,
        couponType: data.couponType,
        discountValue: data.discountValue,
        minimumOrderAmount: data.minimumOrderAmount
          ? parseFloat(data.minimumOrderAmount)
          : null,
        maximumDiscount: data.maximumDiscount
          ? parseFloat(data.maximumDiscount)
          : null,
        usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
        usagePerUser: data.usagePerUser ? parseInt(data.usagePerUser) : null,
        validFrom: data.validFrom || null,
        validUntil: data.validUntil || null,
        isActive: data.isActive,
        isFirstOrderOnly: data.isFirstOrderOnly,
        buyQuantity: data.buyQuantity ? parseInt(data.buyQuantity) : null,
        getQuantity: data.getQuantity ? parseInt(data.getQuantity) : null,
      }
      const response = await apiClient.put<Coupon>(`/coupons/${id}`, payload)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      queryClient.invalidateQueries({ queryKey: ['coupon-stats'] })
      toast.success('Coupon updated successfully')
      setIsEditDialogOpen(false)
      setSelectedCoupon(null)
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update coupon')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/coupons/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      queryClient.invalidateQueries({ queryKey: ['coupon-stats'] })
      toast.success('Coupon deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete coupon')
    },
  })

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/coupons/${id}/toggle`,
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      queryClient.invalidateQueries({ queryKey: ['coupon-stats'] })
      toast.success('Coupon status updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update status')
    },
  })

  // Generate coupons mutation
  const generateMutation = useMutation({
    mutationFn: async (data: typeof generateData) => {
      const response = await apiClient.post<{ count: number }>(
        '/coupons/generate',
        {
          prefix: data.prefix.toUpperCase(),
          count: data.count,
          couponType: data.couponType,
          discountValue: data.discountValue,
          usageLimit: data.usageLimit,
          validDays: data.validDays,
        },
      )
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      queryClient.invalidateQueries({ queryKey: ['coupon-stats'] })
      toast.success(`Generated ${data.count} coupons`)
      setIsGenerateDialogOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate coupons')
    },
  })

  const resetForm = useCallback(() => {
    setFormData({
      code: '',
      name: '',
      description: '',
      couponType: 'percentage',
      discountValue: 0,
      minimumOrderAmount: '',
      maximumDiscount: '',
      usageLimit: '',
      usagePerUser: '',
      validFrom: '',
      validUntil: '',
      isActive: true,
      isFirstOrderOnly: false,
      buyQuantity: '',
      getQuantity: '',
    })
  }, [])

  const handleEdit = useCallback((coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      couponType: coupon.coupon_type,
      discountValue: coupon.discount_value,
      minimumOrderAmount: coupon.minimum_order_amount?.toString() || '',
      maximumDiscount: coupon.maximum_discount?.toString() || '',
      usageLimit: coupon.usage_limit?.toString() || '',
      usagePerUser: coupon.usage_per_user?.toString() || '',
      validFrom: coupon.valid_from
        ? format(parseISO(coupon.valid_from), "yyyy-MM-dd'T'HH:mm")
        : '',
      validUntil: coupon.valid_until
        ? format(parseISO(coupon.valid_until), "yyyy-MM-dd'T'HH:mm")
        : '',
      isActive: coupon.is_active,
      isFirstOrderOnly: coupon.is_first_order_only,
      buyQuantity: coupon.buy_quantity?.toString() || '',
      getQuantity: coupon.get_quantity?.toString() || '',
    })
    setIsEditDialogOpen(true)
  }, [])

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Coupon code copied!')
  }, [])

  const formatDiscount = (coupon: Coupon) => {
    switch (coupon.coupon_type) {
      case 'percentage':
        return `${coupon.discount_value}%`
      case 'fixed_amount':
        return `$${coupon.discount_value.toFixed(2)}`
      case 'free_shipping':
        return 'Free Shipping'
      case 'buy_x_get_y':
        return `Buy ${coupon.buy_quantity} Get ${coupon.get_quantity}`
      default:
        return coupon.discount_value.toString()
    }
  }

  const coupons = couponsData?.coupons || []
  const pagination = couponsData
    ? {
        total: couponsData.total,
        page: couponsData.page,
        limit: couponsData.limit,
        totalPages: Math.ceil(couponsData.total / couponsData.limit),
      }
    : null

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Coupons & Promotions
          </h1>
          <p className='text-muted-foreground'>
            Create and manage discount codes and promotional offers
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => setIsGenerateDialogOpen(true)}
          >
            <Sparkles className='mr-2 h-4 w-4' />
            Generate Bulk
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Coupons</CardTitle>
            <Tag className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.totalCoupons || 0}</div>
            <p className='text-xs text-muted-foreground'>
              {stats?.activeCoupons || 0} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Usage</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.totalUsage || 0}</div>
            <p className='text-xs text-muted-foreground'>Times redeemed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Discount
            </CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              ${(stats?.totalDiscount || 0).toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground'>Total savings given</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Expired</CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.expiredCoupons || 0}
            </div>
            <p className='text-xs text-muted-foreground'>Expired codes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-wrap gap-4'>
            <div className='flex-1 min-w-50'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='Search coupons...'
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value, page: 1 })
                  }
                  className='pl-9'
                />
              </div>
            </div>
            <Select
              value={filters.status}
              onValueChange={(value: string) =>
                setFilters({ ...filters, status: value, page: 1 })
              }
            >
              <SelectTrigger className='w-37.5'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='inactive'>Inactive</SelectItem>
                <SelectItem value='expired'>Expired</SelectItem>
                <SelectItem value='scheduled'>Scheduled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.type}
              onValueChange={(value: string) =>
                setFilters({ ...filters, type: value, page: 1 })
              }
            >
              <SelectTrigger className='w-45'>
                <SelectValue placeholder='Type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Types</SelectItem>
                <SelectItem value='percentage'>Percentage</SelectItem>
                <SelectItem value='fixed_amount'>Fixed Amount</SelectItem>
                <SelectItem value='free_shipping'>Free Shipping</SelectItem>
                <SelectItem value='buy_x_get_y'>Buy X Get Y</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant='outline'
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['coupons'] })
              }
            >
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
          <CardDescription>
            Manage your discount codes and track their usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {couponsLoading ? (
            <div className='space-y-4'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className='text-center py-12'>
              <Tag className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No coupons found</h3>
              <p className='text-muted-foreground'>
                Create your first coupon to start offering discounts
              </p>
              <Button
                className='mt-4'
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className='mr-2 h-4 w-4' />
                Create Coupon
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Valid Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='w-25'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon: Coupon) => {
                    const TypeIcon = TYPE_ICONS[coupon.coupon_type] || Tag
                    const statusConfig =
                      STATUS_CONFIG[coupon.status] || STATUS_CONFIG.inactive
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <code className='font-mono font-semibold bg-muted px-2 py-1 rounded'>
                              {coupon.code}
                            </code>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8'
                              onClick={() => copyCode(coupon.code)}
                            >
                              <Copy className='h-3 w-3' />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{coupon.name}</div>
                            {coupon.description && (
                              <div className='text-xs text-muted-foreground truncate max-w-50'>
                                {coupon.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <TypeIcon className='h-4 w-4 text-muted-foreground' />
                            <span className='capitalize text-sm'>
                              {coupon.coupon_type.replace('_', ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className='font-semibold'>
                            {formatDiscount(coupon)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className='text-sm'>
                            {coupon.usage_count}
                            {coupon.usage_limit && (
                              <span className='text-muted-foreground'>
                                {' '}
                                / {coupon.usage_limit}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='text-sm'>
                            {coupon.valid_from && (
                              <div className='flex items-center gap-1'>
                                <Calendar className='h-3 w-3 text-muted-foreground' />
                                {format(
                                  parseISO(coupon.valid_from),
                                  'MMM d, yyyy',
                                )}
                              </div>
                            )}
                            {coupon.valid_until && (
                              <div className='flex items-center gap-1 text-muted-foreground'>
                                <span>to</span>
                                {format(
                                  parseISO(coupon.valid_until),
                                  'MMM d, yyyy',
                                )}
                              </div>
                            )}
                            {!coupon.valid_from && !coupon.valid_until && (
                              <span className='text-muted-foreground'>
                                No expiry
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon'>
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleEdit(coupon)}
                              >
                                <Edit className='mr-2 h-4 w-4' />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyCode(coupon.code)}
                              >
                                <Copy className='mr-2 h-4 w-4' />
                                Copy Code
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleStatusMutation.mutate(coupon.id)
                                }
                              >
                                {coupon.is_active ? (
                                  <>
                                    <XCircle className='mr-2 h-4 w-4' />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className='mr-2 h-4 w-4' />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className='text-destructive'
                                onClick={() => deleteMutation.mutate(coupon.id)}
                              >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    )}{' '}
                    of {pagination.total} coupons
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setFilters({ ...filters, page: filters.page - 1 })
                      }
                      disabled={filters.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setFilters({ ...filters, page: filters.page + 1 })
                      }
                      disabled={filters.page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setIsCreateDialogOpen(false)
            setIsEditDialogOpen(false)
            setSelectedCoupon(null)
            resetForm()
          }
        }}
      >
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? 'Edit Coupon' : 'Create New Coupon'}
            </DialogTitle>
            <DialogDescription>
              {isEditDialogOpen
                ? 'Update the coupon details below'
                : 'Fill in the details to create a new discount code'}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='code'>Coupon Code *</Label>
                <Input
                  id='code'
                  placeholder='e.g., SAVE20'
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='name'>Name *</Label>
                <Input
                  id='name'
                  placeholder='e.g., Summer Sale 20%'
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                placeholder='Brief description of the promotion...'
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <Separator />

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>Discount Type *</Label>
                <Select
                  value={formData.couponType}
                  onValueChange={(value: Coupon['coupon_type']) =>
                    setFormData({ ...formData, couponType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='percentage'>
                      <div className='flex items-center gap-2'>
                        <Percent className='h-4 w-4' />
                        Percentage Off
                      </div>
                    </SelectItem>
                    <SelectItem value='fixed_amount'>
                      <div className='flex items-center gap-2'>
                        <DollarSign className='h-4 w-4' />
                        Fixed Amount Off
                      </div>
                    </SelectItem>
                    <SelectItem value='free_shipping'>
                      <div className='flex items-center gap-2'>
                        <Truck className='h-4 w-4' />
                        Free Shipping
                      </div>
                    </SelectItem>
                    <SelectItem value='buy_x_get_y'>
                      <div className='flex items-center gap-2'>
                        <Gift className='h-4 w-4' />
                        Buy X Get Y
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.couponType !== 'free_shipping' &&
                formData.couponType !== 'buy_x_get_y' && (
                  <div className='space-y-2'>
                    <Label htmlFor='discountValue'>
                      {formData.couponType === 'percentage'
                        ? 'Percentage (%)'
                        : 'Amount ($)'}
                    </Label>
                    <Input
                      id='discountValue'
                      type='number'
                      min='0'
                      max={
                        formData.couponType === 'percentage' ? 100 : undefined
                      }
                      value={formData.discountValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountValue: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}

              {formData.couponType === 'buy_x_get_y' && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='buyQuantity'>Buy Quantity</Label>
                    <Input
                      id='buyQuantity'
                      type='number'
                      min='1'
                      value={formData.buyQuantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          buyQuantity: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='getQuantity'>Get Free Quantity</Label>
                    <Input
                      id='getQuantity'
                      type='number'
                      min='1'
                      value={formData.getQuantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          getQuantity: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <Separator />

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='minimumOrderAmount'>Minimum Order Amount</Label>
                <Input
                  id='minimumOrderAmount'
                  type='number'
                  min='0'
                  placeholder='No minimum'
                  value={formData.minimumOrderAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minimumOrderAmount: e.target.value,
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='maximumDiscount'>Maximum Discount</Label>
                <Input
                  id='maximumDiscount'
                  type='number'
                  min='0'
                  placeholder='No maximum'
                  value={formData.maximumDiscount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maximumDiscount: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='usageLimit'>Total Usage Limit</Label>
                <Input
                  id='usageLimit'
                  type='number'
                  min='1'
                  placeholder='Unlimited'
                  value={formData.usageLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, usageLimit: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='usagePerUser'>Per User Limit</Label>
                <Input
                  id='usagePerUser'
                  type='number'
                  min='1'
                  placeholder='Unlimited'
                  value={formData.usagePerUser}
                  onChange={(e) =>
                    setFormData({ ...formData, usagePerUser: e.target.value })
                  }
                />
              </div>
            </div>

            <Separator />

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='validFrom'>Valid From</Label>
                <Input
                  id='validFrom'
                  type='datetime-local'
                  value={formData.validFrom}
                  onChange={(e) =>
                    setFormData({ ...formData, validFrom: e.target.value })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='validUntil'>Valid Until</Label>
                <Input
                  id='validUntil'
                  type='datetime-local'
                  value={formData.validUntil}
                  onChange={(e) =>
                    setFormData({ ...formData, validUntil: e.target.value })
                  }
                />
              </div>
            </div>

            <Separator />

            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label>Active</Label>
                  <p className='text-xs text-muted-foreground'>
                    Coupon can be used by customers
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </div>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label>First Order Only</Label>
                  <p className='text-xs text-muted-foreground'>
                    Only valid for new customers
                  </p>
                </div>
                <Switch
                  checked={formData.isFirstOrderOnly}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, isFirstOrderOnly: checked })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setIsCreateDialogOpen(false)
                setIsEditDialogOpen(false)
                setSelectedCoupon(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (isEditDialogOpen && selectedCoupon) {
                  updateMutation.mutate({
                    id: selectedCoupon.id,
                    data: formData,
                  })
                } else {
                  createMutation.mutate(formData)
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : isEditDialogOpen ? (
                'Update Coupon'
              ) : (
                'Create Coupon'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Bulk Dialog */}
      <Dialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Bulk Coupons</DialogTitle>
            <DialogDescription>
              Generate multiple unique coupon codes at once
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='prefix'>Code Prefix</Label>
                <Input
                  id='prefix'
                  placeholder='e.g., SUMMER'
                  value={generateData.prefix}
                  onChange={(e) =>
                    setGenerateData({
                      ...generateData,
                      prefix: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='count'>Number of Codes</Label>
                <Input
                  id='count'
                  type='number'
                  min='1'
                  max='1000'
                  value={generateData.count}
                  onChange={(e) =>
                    setGenerateData({
                      ...generateData,
                      count: parseInt(e.target.value) || 10,
                    })
                  }
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>Discount Type</Label>
                <Select
                  value={generateData.couponType}
                  onValueChange={(value: Coupon['coupon_type']) =>
                    setGenerateData({ ...generateData, couponType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='percentage'>Percentage</SelectItem>
                    <SelectItem value='fixed_amount'>Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='discountValue'>Discount Value</Label>
                <Input
                  id='discountValue'
                  type='number'
                  min='1'
                  value={generateData.discountValue}
                  onChange={(e) =>
                    setGenerateData({
                      ...generateData,
                      discountValue: parseFloat(e.target.value) || 10,
                    })
                  }
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='usageLimit'>Usage Limit (per code)</Label>
                <Input
                  id='usageLimit'
                  type='number'
                  min='1'
                  value={generateData.usageLimit}
                  onChange={(e) =>
                    setGenerateData({
                      ...generateData,
                      usageLimit: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='validDays'>Valid For (days)</Label>
                <Input
                  id='validDays'
                  type='number'
                  min='1'
                  value={generateData.validDays}
                  onChange={(e) =>
                    setGenerateData({
                      ...generateData,
                      validDays: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>
            </div>

            <div className='bg-muted p-3 rounded-md text-sm'>
              <p>
                This will generate <strong>{generateData.count}</strong> unique
                codes like:{' '}
                <code className='bg-background px-1 rounded'>
                  {generateData.prefix || 'CODE'}-XXXXXX
                </code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsGenerateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate(generateData)}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className='mr-2 h-4 w-4' />
                  Generate Coupons
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

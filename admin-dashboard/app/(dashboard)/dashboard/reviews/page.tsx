'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Star,
  Search,
  MoreHorizontal,
  Check,
  X,
  Flag,
  MessageSquare,
  ThumbsUp,
  RefreshCw,
  Image,
  User,
  Package,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  ChevronDown,
  Sparkles,
  Award,
  BarChart3,
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
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import apiClient from '@/lib/api-client'

// Types
interface Review {
  id: string
  product_id: string
  user_id: string
  order_item_id: string | null
  rating: number
  title: string | null
  comment: string | null
  status: 'pending' | 'approved' | 'rejected' | 'flagged'
  is_verified_purchase: boolean
  is_featured: boolean
  helpful_count: number
  not_helpful_count: number
  report_count: number
  admin_response: string | null
  admin_responded_at: string | null
  created_at: string
  updated_at: string
  // Joined data
  product_name?: string
  product_image?: string
  user_name?: string
  user_email?: string
  images?: ReviewImage[]
}

interface ReviewImage {
  id: string
  image_url: string
  display_order: number
}

interface ReviewStats {
  totalReviews: number
  pendingReviews: number
  approvedReviews: number
  rejectedReviews: number
  flaggedReviews: number
  averageRating: number
  totalRatings: { rating: number; count: number }[]
  recentReviews: number
}

interface ReviewFilters {
  search: string
  status: string
  rating: string
  isVerifiedPurchase: string
  isFeatured: string
  hasImages: boolean
  page: number
  limit: number
}

// Status badge config
const STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: typeof Check
  }
> = {
  pending: { label: 'Pending', variant: 'secondary', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  flagged: { label: 'Flagged', variant: 'outline', icon: AlertTriangle },
}

// Star rating component
function StarRating({
  rating,
  size = 'sm',
}: {
  rating: number
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <div className='flex items-center gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          }`}
        />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ReviewFilters>({
    search: '',
    status: 'all',
    rating: 'all',
    isVerifiedPurchase: 'all',
    isFeatured: 'all',
    hasImages: false,
    page: 1,
    limit: 20,
  })
  const [selectedReviews, setSelectedReviews] = useState<string[]>([])
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [responseText, setResponseText] = useState('')

  // Fetch reviews
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status !== 'all') params.append('status', filters.status)
      if (filters.rating !== 'all') params.append('rating', filters.rating)
      if (filters.isVerifiedPurchase !== 'all')
        params.append('isVerifiedPurchase', filters.isVerifiedPurchase)
      if (filters.isFeatured !== 'all')
        params.append('isFeatured', filters.isFeatured)
      if (filters.hasImages) params.append('hasImages', 'true')
      params.append('page', filters.page.toString())
      params.append('limit', filters.limit.toString())

      const response = await apiClient.get<{
        reviews: Review[]
        total: number
        page: number
        limit: number
      }>(`/reviews?${params.toString()}`)
      return response
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['review-stats'],
    queryFn: async () => {
      const response = await apiClient.get<ReviewStats>('/reviews/stats')
      return response
    },
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/reviews/${id}/approve`,
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })
      toast.success('Review approved')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve review')
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/reviews/${id}/reject`,
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })
      toast.success('Review rejected')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject review')
    },
  })

  // Toggle featured mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/reviews/${id}/featured`,
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Featured status updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update featured status')
    },
  })

  // Add response mutation
  const addResponseMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const res = await apiClient.post<{ success: boolean }>(
        `/reviews/${id}/response`,
        { response },
      )
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success('Response added')
      setIsResponseDialogOpen(false)
      setResponseText('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add response')
    },
  })

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (reviewIds: string[]) => {
      const response = await apiClient.post<{ message: string }>(
        '/reviews/bulk/approve',
        { reviewIds },
      )
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })
      toast.success(data.message || 'Reviews approved')
      setSelectedReviews([])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve reviews')
    },
  })

  // Bulk reject mutation
  const bulkRejectMutation = useMutation({
    mutationFn: async (reviewIds: string[]) => {
      const response = await apiClient.post<{ message: string }>(
        '/reviews/bulk/reject',
        { reviewIds },
      )
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })
      toast.success(data.message || 'Reviews rejected')
      setSelectedReviews([])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject reviews')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reviews/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })
      toast.success('Review deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete review')
    },
  })

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedReviews(reviews.map((r: Review) => r.id))
      } else {
        setSelectedReviews([])
      }
    },
    [reviewsData],
  )

  const handleSelectReview = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedReviews((prev) => [...prev, id])
    } else {
      setSelectedReviews((prev) => prev.filter((r) => r !== id))
    }
  }, [])

  const openDetailDialog = useCallback((review: Review) => {
    setSelectedReview(review)
    setIsDetailDialogOpen(true)
  }, [])

  const openResponseDialog = useCallback((review: Review) => {
    setSelectedReview(review)
    setResponseText(review.admin_response || '')
    setIsResponseDialogOpen(true)
  }, [])

  const reviews = reviewsData?.reviews || []
  const pagination = reviewsData
    ? {
        total: reviewsData.total,
        page: reviewsData.page,
        limit: reviewsData.limit,
        totalPages: Math.ceil(reviewsData.total / reviewsData.limit),
      }
    : null

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Reviews</h1>
          <p className='text-muted-foreground'>
            Moderate and manage customer reviews
          </p>
        </div>
        <div className='flex gap-2'>
          {selectedReviews.length > 0 && (
            <>
              <Button
                variant='outline'
                onClick={() => bulkApproveMutation.mutate(selectedReviews)}
                disabled={bulkApproveMutation.isPending}
              >
                <Check className='mr-2 h-4 w-4' />
                Approve ({selectedReviews.length})
              </Button>
              <Button
                variant='outline'
                onClick={() => bulkRejectMutation.mutate(selectedReviews)}
                disabled={bulkRejectMutation.isPending}
              >
                <X className='mr-2 h-4 w-4' />
                Reject ({selectedReviews.length})
              </Button>
            </>
          )}
          <Button
            variant='outline'
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['reviews'] })
            }
          >
            <RefreshCw className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Reviews</CardTitle>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats?.totalReviews || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Pending</CardTitle>
            <Clock className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.pendingReviews || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Approved</CardTitle>
            <CheckCircle className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.approvedReviews || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Flagged</CardTitle>
            <AlertTriangle className='h-4 w-4 text-orange-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.flaggedReviews || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Avg Rating</CardTitle>
            <Star className='h-4 w-4 text-yellow-400' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats?.averageRating?.toFixed(1) || '0.0'}
            </div>
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
                  placeholder='Search reviews...'
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
              <SelectTrigger className='w-35'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='approved'>Approved</SelectItem>
                <SelectItem value='rejected'>Rejected</SelectItem>
                <SelectItem value='flagged'>Flagged</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.rating}
              onValueChange={(value: string) =>
                setFilters({ ...filters, rating: value, page: 1 })
              }
            >
              <SelectTrigger className='w-32.5'>
                <SelectValue placeholder='Rating' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Ratings</SelectItem>
                <SelectItem value='5'>5 Stars</SelectItem>
                <SelectItem value='4'>4 Stars</SelectItem>
                <SelectItem value='3'>3 Stars</SelectItem>
                <SelectItem value='2'>2 Stars</SelectItem>
                <SelectItem value='1'>1 Star</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.isVerifiedPurchase}
              onValueChange={(value: string) =>
                setFilters({ ...filters, isVerifiedPurchase: value, page: 1 })
              }
            >
              <SelectTrigger className='w-40'>
                <SelectValue placeholder='Purchase' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Reviews</SelectItem>
                <SelectItem value='true'>Verified Only</SelectItem>
                <SelectItem value='false'>Unverified Only</SelectItem>
              </SelectContent>
            </Select>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='hasImages'
                checked={filters.hasImages}
                onCheckedChange={(checked: boolean) =>
                  setFilters({ ...filters, hasImages: checked, page: 1 })
                }
              />
              <Label htmlFor='hasImages' className='text-sm cursor-pointer'>
                With Images
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
          <CardDescription>
            Review and moderate customer feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviewsLoading ? (
            <div className='space-y-4'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-24 w-full' />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className='text-center py-12'>
              <MessageSquare className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No reviews found</h3>
              <p className='text-muted-foreground'>
                No reviews match your current filters
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-12'>
                      <Checkbox
                        checked={
                          selectedReviews.length === reviews.length &&
                          reviews.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className='w-25'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review: Review) => {
                    const statusConfig =
                      STATUS_CONFIG[review.status] || STATUS_CONFIG.pending
                    const StatusIcon = statusConfig.icon
                    return (
                      <TableRow key={review.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedReviews.includes(review.id)}
                            onCheckedChange={(checked: boolean) =>
                              handleSelectReview(review.id, checked)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className='flex items-start gap-3'>
                            <Avatar className='h-10 w-10'>
                              <AvatarFallback>
                                {review.user_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className='space-y-1'>
                              <div className='flex items-center gap-2'>
                                <span className='font-medium text-sm'>
                                  {review.user_name || 'Anonymous'}
                                </span>
                                {review.is_verified_purchase && (
                                  <Badge
                                    variant='secondary'
                                    className='text-xs'
                                  >
                                    <CheckCircle className='mr-1 h-3 w-3' />
                                    Verified
                                  </Badge>
                                )}
                                {review.is_featured && (
                                  <Badge variant='default' className='text-xs'>
                                    <Award className='mr-1 h-3 w-3' />
                                    Featured
                                  </Badge>
                                )}
                              </div>
                              {review.title && (
                                <p className='font-medium text-sm'>
                                  {review.title}
                                </p>
                              )}
                              <p className='text-sm text-muted-foreground line-clamp-2 max-w-md'>
                                {review.comment || 'No comment'}
                              </p>
                              <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                                <span className='flex items-center gap-1'>
                                  <ThumbsUp className='h-3 w-3' />
                                  {review.helpful_count}
                                </span>
                                {review.images && review.images.length > 0 && (
                                  <span className='flex items-center gap-1'>
                                    <Image className='h-3 w-3' />
                                    {review.images.length} images
                                  </span>
                                )}
                                {review.report_count > 0 && (
                                  <span className='flex items-center gap-1 text-red-500'>
                                    <Flag className='h-3 w-3' />
                                    {review.report_count} reports
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            {review.product_image && (
                              <img
                                src={review.product_image}
                                alt=''
                                className='h-10 w-10 rounded object-cover'
                              />
                            )}
                            <span className='text-sm truncate max-w-37.5'>
                              {review.product_name || 'Unknown Product'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StarRating rating={review.rating} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            <StatusIcon className='mr-1 h-3 w-3' />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className='text-sm text-muted-foreground'>
                            {format(parseISO(review.created_at), 'MMM d, yyyy')}
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
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDetailDialog(review)}
                              >
                                <Eye className='mr-2 h-4 w-4' />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openResponseDialog(review)}
                              >
                                <MessageSquare className='mr-2 h-4 w-4' />
                                Add Response
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleFeaturedMutation.mutate(review.id)
                                }
                              >
                                <Award className='mr-2 h-4 w-4' />
                                {review.is_featured ? 'Unfeature' : 'Feature'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {review.status !== 'approved' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    approveMutation.mutate(review.id)
                                  }
                                >
                                  <Check className='mr-2 h-4 w-4' />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {review.status !== 'rejected' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    rejectMutation.mutate(review.id)
                                  }
                                >
                                  <X className='mr-2 h-4 w-4' />
                                  Reject
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className='text-destructive'
                                onClick={() => deleteMutation.mutate(review.id)}
                              >
                                <X className='mr-2 h-4 w-4' />
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
                    of {pagination.total} reviews
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

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>

          {selectedReview && (
            <div className='space-y-6'>
              {/* Reviewer Info */}
              <div className='flex items-start gap-4'>
                <Avatar className='h-12 w-12'>
                  <AvatarFallback>
                    {selectedReview.user_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className='flex items-center gap-2'>
                    <span className='font-semibold'>
                      {selectedReview.user_name || 'Anonymous'}
                    </span>
                    {selectedReview.is_verified_purchase && (
                      <Badge variant='secondary'>
                        <CheckCircle className='mr-1 h-3 w-3' />
                        Verified Purchase
                      </Badge>
                    )}
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    {selectedReview.user_email}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {format(
                      parseISO(selectedReview.created_at),
                      "MMMM d, yyyy 'at' h:mm a",
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Product Info */}
              <div className='flex items-center gap-4'>
                {selectedReview.product_image && (
                  <img
                    src={selectedReview.product_image}
                    alt=''
                    className='h-16 w-16 rounded object-cover'
                  />
                )}
                <div>
                  <p className='font-medium'>
                    {selectedReview.product_name || 'Unknown Product'}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    Product ID: {selectedReview.product_id}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Rating & Review */}
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <StarRating rating={selectedReview.rating} size='md' />
                  <span className='text-lg font-semibold'>
                    {selectedReview.rating}/5
                  </span>
                </div>
                {selectedReview.title && (
                  <h3 className='text-lg font-semibold'>
                    {selectedReview.title}
                  </h3>
                )}
                <p className='text-muted-foreground'>
                  {selectedReview.comment || 'No comment provided'}
                </p>
              </div>

              {/* Images */}
              {selectedReview.images && selectedReview.images.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className='font-medium mb-2'>Attached Images</p>
                    <div className='flex gap-2 flex-wrap'>
                      {selectedReview.images.map((img) => (
                        <img
                          key={img.id}
                          src={img.image_url}
                          alt=''
                          className='h-24 w-24 rounded object-cover cursor-pointer hover:opacity-80'
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Stats */}
              <Separator />
              <div className='flex gap-6 text-sm'>
                <div className='flex items-center gap-1'>
                  <ThumbsUp className='h-4 w-4 text-muted-foreground' />
                  <span>{selectedReview.helpful_count} helpful</span>
                </div>
                <div className='flex items-center gap-1'>
                  <Flag className='h-4 w-4 text-muted-foreground' />
                  <span>{selectedReview.report_count} reports</span>
                </div>
              </div>

              {/* Admin Response */}
              {selectedReview.admin_response && (
                <>
                  <Separator />
                  <div className='bg-muted p-4 rounded-lg'>
                    <div className='flex items-center gap-2 mb-2'>
                      <Badge>Store Response</Badge>
                      {selectedReview.admin_responded_at && (
                        <span className='text-xs text-muted-foreground'>
                          {format(
                            parseISO(selectedReview.admin_responded_at),
                            'MMM d, yyyy',
                          )}
                        </span>
                      )}
                    </div>
                    <p className='text-sm'>{selectedReview.admin_response}</p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className='gap-2'>
            {selectedReview?.status !== 'approved' && (
              <Button
                variant='outline'
                onClick={() => {
                  approveMutation.mutate(selectedReview!.id)
                  setIsDetailDialogOpen(false)
                }}
              >
                <Check className='mr-2 h-4 w-4' />
                Approve
              </Button>
            )}
            {selectedReview?.status !== 'rejected' && (
              <Button
                variant='outline'
                onClick={() => {
                  rejectMutation.mutate(selectedReview!.id)
                  setIsDetailDialogOpen(false)
                }}
              >
                <X className='mr-2 h-4 w-4' />
                Reject
              </Button>
            )}
            <Button
              onClick={() => {
                setIsDetailDialogOpen(false)
                openResponseDialog(selectedReview!)
              }}
            >
              <MessageSquare className='mr-2 h-4 w-4' />
              Add Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response Dialog */}
      <Dialog
        open={isResponseDialogOpen}
        onOpenChange={setIsResponseDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Store Response</DialogTitle>
            <DialogDescription>
              Your response will be publicly visible below the customer review
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            {selectedReview && (
              <div className='bg-muted p-3 rounded-lg'>
                <div className='flex items-center gap-2 mb-2'>
                  <StarRating rating={selectedReview.rating} />
                  <span className='text-sm font-medium'>
                    {selectedReview.user_name}
                  </span>
                </div>
                <p className='text-sm text-muted-foreground line-clamp-3'>
                  {selectedReview.comment ||
                    selectedReview.title ||
                    'No comment'}
                </p>
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='response'>Your Response</Label>
              <Textarea
                id='response'
                placeholder='Thank you for your feedback...'
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsResponseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedReview && responseText.trim()) {
                  addResponseMutation.mutate({
                    id: selectedReview.id,
                    response: responseText.trim(),
                  })
                }
              }}
              disabled={addResponseMutation.isPending || !responseText.trim()}
            >
              {addResponseMutation.isPending ? (
                <>
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Response'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

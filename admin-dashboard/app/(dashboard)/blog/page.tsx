'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blogService, BlogPost, GetPostsParams } from '@/services/blog.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Plus,
  FileText,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'

const STATUS_BADGES = {
  draft: { label: 'Draft', variant: 'secondary' as const, icon: Clock },
  pending: { label: 'Pending', variant: 'outline' as const, icon: Clock },
  published: {
    label: 'Published',
    variant: 'default' as const,
    icon: CheckCircle,
  },
  scheduled: { label: 'Scheduled', variant: 'outline' as const, icon: Clock },
  archived: { label: 'Archived', variant: 'secondary' as const, icon: XCircle },
}

const VISIBILITY_ICONS = {
  public: Globe,
  private: Lock,
  password_protected: Lock,
}

export default function BlogPostsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Filters
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // UI State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const params: GetPostsParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: status || undefined,
    sortBy,
    sortOrder,
  }

  // Fetch posts
  const {
    data: postsResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['blog-posts', params],
    queryFn: () => blogService.getPosts(params),
  })

  // Fetch categories for filter
  const { data: categoriesResponse } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => blogService.getCategories(),
  })

  const posts = postsResponse?.data?.posts || []
  const pagination = postsResponse?.data?.pagination
  const categories = categoriesResponse?.data || []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => blogService.deletePost(id),
    onSuccess: () => {
      toast.success('Post deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
      setDeleteDialogOpen(false)
      setPostToDelete(null)
    },
    onError: () => {
      toast.error('Failed to delete post')
    },
  })

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: (id: string) => blogService.publishPost(id),
    onSuccess: () => {
      toast.success('Post published successfully')
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
    },
    onError: () => {
      toast.error('Failed to publish post')
    },
  })

  // Unpublish mutation
  const unpublishMutation = useMutation({
    mutationFn: (id: string) => blogService.unpublishPost(id),
    onSuccess: () => {
      toast.success('Post unpublished successfully')
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] })
    },
    onError: () => {
      toast.error('Failed to unpublish post')
    },
  })

  const handleDeleteClick = useCallback((post: BlogPost) => {
    setPostToDelete(post)
    setDeleteDialogOpen(true)
  }, [])

  const handleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
      } else {
        setSortBy(column)
        setSortOrder('desc')
      }
    },
    [sortBy, sortOrder],
  )

  const clearFilters = useCallback(() => {
    setSearch('')
    setStatus('')
    setPage(1)
  }, [])

  const hasActiveFilters = search || status

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight flex items-center gap-2'>
            <FileText className='h-8 w-8' />
            Blog Posts
          </h1>
          <p className='text-muted-foreground mt-1'>
            Manage your blog posts, articles, and content
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
          <Link href='/blog/new'>
            <Button>
              <Plus className='h-4 w-4 mr-2' />
              New Post
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-col sm:flex-row gap-4'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search posts...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-10'
              />
            </div>
            <Select
              value={status || 'all'}
              onValueChange={(value: string) =>
                setStatus(value === 'all' ? '' : value)
              }
            >
              <SelectTrigger className='w-full sm:w-40'>
                <SelectValue placeholder='All Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='draft'>Draft</SelectItem>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='published'>Published</SelectItem>
                <SelectItem value='scheduled'>Scheduled</SelectItem>
                <SelectItem value='archived'>Archived</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant='ghost' onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.total} posts total` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-4'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className='text-center py-12'>
              <FileText className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <h3 className='text-lg font-semibold'>No posts found</h3>
              <p className='text-muted-foreground'>
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Create your first post to get started'}
              </p>
              {!hasActiveFilters && (
                <Link href='/blog/new'>
                  <Button className='mt-4'>
                    <Plus className='h-4 w-4 mr-2' />
                    Create Post
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-100'>
                      <button
                        className='flex items-center gap-1 hover:text-foreground'
                        onClick={() => handleSort('title')}
                      >
                        Title
                        <ArrowUpDown className='h-4 w-4' />
                      </button>
                    </TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-center'>Views</TableHead>
                    <TableHead>
                      <button
                        className='flex items-center gap-1 hover:text-foreground'
                        onClick={() => handleSort('created_at')}
                      >
                        Created
                        <ArrowUpDown className='h-4 w-4' />
                      </button>
                    </TableHead>
                    <TableHead className='w-17.5'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => {
                    const statusConfig =
                      STATUS_BADGES[post.status] || STATUS_BADGES.draft
                    const StatusIcon = statusConfig.icon
                    const VisibilityIcon =
                      VISIBILITY_ICONS[post.visibility] || Globe

                    return (
                      <TableRow key={post.id}>
                        <TableCell>
                          <div className='flex flex-col gap-1'>
                            <div className='flex items-center gap-2'>
                              <Link
                                href={`/blog/${post.id}`}
                                className='font-medium hover:underline'
                              >
                                {post.title}
                              </Link>
                              {post.is_featured && (
                                <Badge variant='secondary' className='text-xs'>
                                  Featured
                                </Badge>
                              )}
                              {post.is_pinned && (
                                <Badge variant='outline' className='text-xs'>
                                  Pinned
                                </Badge>
                              )}
                            </div>
                            <span className='text-sm text-muted-foreground line-clamp-1'>
                              {post.excerpt || 'No excerpt'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {post.category?.name || (
                            <span className='text-muted-foreground'>
                              Uncategorized
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {post.author?.display_name || (
                            <span className='text-muted-foreground'>
                              Unknown
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <Badge
                              variant={statusConfig.variant}
                              className='gap-1'
                            >
                              <StatusIcon className='h-3 w-3' />
                              {statusConfig.label}
                            </Badge>
                            <VisibilityIcon className='h-4 w-4 text-muted-foreground' />
                          </div>
                        </TableCell>
                        <TableCell className='text-center'>
                          {post.view_count.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {format(new Date(post.created_at), 'MMM d, yyyy')}
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
                              <DropdownMenuItem asChild>
                                <Link href={`/blog/${post.id}`}>
                                  <Eye className='h-4 w-4 mr-2' />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/blog/${post.id}/edit`}>
                                  <Edit className='h-4 w-4 mr-2' />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {post.status !== 'published' ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    publishMutation.mutate(post.id)
                                  }
                                  disabled={publishMutation.isPending}
                                >
                                  <CheckCircle className='h-4 w-4 mr-2' />
                                  Publish
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    unpublishMutation.mutate(post.id)
                                  }
                                  disabled={unpublishMutation.isPending}
                                >
                                  <XCircle className='h-4 w-4 mr-2' />
                                  Unpublish
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className='text-destructive'
                                onClick={() => handleDeleteClick(post)}
                              >
                                <Trash2 className='h-4 w-4 mr-2' />
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
                <div className='flex items-center justify-between pt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => p + 1)}
                      disabled={pagination.page >= pagination.totalPages}
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{postToDelete?.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() =>
                postToDelete && deleteMutation.mutate(postToDelete.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

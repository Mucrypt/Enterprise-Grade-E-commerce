'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { bookService, type BookReviewQueueItem } from '@/services/books.service'
import { useAuthStore } from '@/lib/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  BookPlus,
  BookOpen,
  CheckCircle2,
  Clock3,
  CloudUpload,
  LibraryBig,
  ShieldAlert,
  ThumbsDown,
} from 'lucide-react'

type AdminPublicationAction = 'draft' | 'submit' | 'publish'

const makeIdempotencyKey = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `adm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const parseQueue = (response: unknown): BookReviewQueueItem[] => {
  const data = (response as { data?: { data?: unknown } })?.data?.data
  const payload = data as
    | {
        items?: BookReviewQueueItem[]
        books?: BookReviewQueueItem[]
        queue?: BookReviewQueueItem[]
      }
    | undefined

  return payload?.items || payload?.books || payload?.queue || []
}

const getBookStatus = (book: BookReviewQueueItem) => {
  const status =
    book.moderation_status ||
    book.moderationStatus ||
    book.publication_status ||
    book.publicationStatus ||
    'draft'
  return status.toLowerCase()
}

export default function BooksPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [newBookId, setNewBookId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    description: '',
    basePrice: '0',
    format: 'pdf' as 'pdf' | 'epub' | 'mobi' | 'azw3' | 'html' | 'audio',
    publicationAction: 'draft' as AdminPublicationAction,
  })
  const [uploadForm, setUploadForm] = useState({
    assetType: 'full' as 'full' | 'sample' | 'cover' | 'audio',
    formatKey: 'pdf' as 'pdf' | 'epub' | 'mobi' | 'azw3' | 'html' | 'audio',
    notes: '',
  })
  const [uploadFiles, setUploadFiles] = useState<File[]>([])

  const userType =
    (user as any)?.user_type || (user as any)?.userType || 'admin'
  const canDirectPublish = userType === 'super_admin'

  const { data: queueResponse, isLoading } = useQuery({
    queryKey: ['admin-books-review-queue'],
    queryFn: async () => bookService.getReviewQueue(),
  })

  const queue = useMemo(() => parseQueue(queueResponse), [queueResponse])

  const pendingCount = queue.filter((book) => {
    const status = getBookStatus(book)
    return (
      status === 'pending' || status === 'submitted' || status === 'in_review'
    )
  }).length

  const publishedCount = queue.filter(
    (book) => getBookStatus(book) === 'published',
  ).length

  const approveMutation = useMutation({
    mutationFn: (bookId: string) => bookService.approveBook(bookId),
    onSuccess: () => {
      toast.success('Book approved')
      queryClient.invalidateQueries({ queryKey: ['admin-books-review-queue'] })
    },
    onError: () => {
      toast.error('Failed to approve book')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ bookId, reason }: { bookId: string; reason?: string }) =>
      bookService.rejectBook(bookId, reason),
    onSuccess: () => {
      toast.success('Book rejected')
      queryClient.invalidateQueries({ queryKey: ['admin-books-review-queue'] })
    },
    onError: () => {
      toast.error('Failed to reject book')
    },
  })

  const createBookMutation = useMutation({
    mutationFn: async () => {
      const action =
        createForm.publicationAction === 'publish' && !canDirectPublish
          ? 'submit'
          : createForm.publicationAction

      return await bookService.createBook({
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || undefined,
        description: createForm.description.trim() || undefined,
        basePrice: Number(createForm.basePrice),
        format: createForm.format,
        publicationAction: action,
        idempotencyKey: makeIdempotencyKey(),
      })
    },
    onSuccess: (response: any) => {
      const createdBookId = response?.data?.book?.id
      if (createdBookId) {
        setNewBookId(createdBookId)
      }
      toast.success('Book metadata created')
      queryClient.invalidateQueries({ queryKey: ['admin-books-review-queue'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create book')
    },
  })

  const uploadAssetsMutation = useMutation({
    mutationFn: async () => {
      if (!newBookId || uploadFiles.length === 0) {
        throw new Error('Create a book and select files before uploading')
      }

      return await bookService.uploadBookAssets(newBookId, uploadFiles, {
        assetType: uploadForm.assetType,
        formatKey: uploadForm.formatKey,
        idempotencyKey: makeIdempotencyKey(),
      })
    },
    onSuccess: () => {
      toast.success('Assets uploaded')
      setUploadFiles([])
      queryClient.invalidateQueries({ queryKey: ['admin-books-review-queue'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to upload assets')
    },
  })

  const submitBookMutation = useMutation({
    mutationFn: async () => {
      if (!newBookId) {
        throw new Error('No book selected to submit')
      }
      return await bookService.submitBook(
        newBookId,
        uploadForm.notes || undefined,
      )
    },
    onSuccess: () => {
      toast.success('Book submitted for moderation')
      queryClient.invalidateQueries({ queryKey: ['admin-books-review-queue'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to submit book')
    },
  })

  const publishBookMutation = useMutation({
    mutationFn: async () => {
      if (!newBookId) {
        throw new Error('No book selected to publish')
      }
      return await bookService.publishBook(
        newBookId,
        uploadForm.notes || undefined,
      )
    },
    onSuccess: () => {
      toast.success('Book published')
      queryClient.invalidateQueries({ queryKey: ['admin-books-review-queue'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to publish book')
    },
  })

  const handleReject = (book: BookReviewQueueItem) => {
    const reason = window.prompt(
      `Add a short reason for rejecting “${book.title}”`,
      'Needs revisions before publication',
    )

    if (reason === null) return

    rejectMutation.mutate({ bookId: book.id, reason })
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'>
            <BookOpen className='h-3.5 w-3.5' />
            Books moderation
          </div>
          <h1 className='mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100'>
            Creator submissions and publication queue
          </h1>
          <p className='mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400'>
            Review incoming books, approve publish-ready titles, and keep the
            marketplace trust layer tight before listings go public.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BookPlus className='h-5 w-5' />
            Create and publish admin books
          </CardTitle>
          <CardDescription>
            Admin and super admin can create platform-owned books, upload
            assets, and submit to moderation. Only super admin can directly
            publish.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='book-name'>Book name</Label>
              <Input
                id='book-name'
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder='PLR Masterclass Volume 1'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='book-slug'>Slug (optional)</Label>
              <Input
                id='book-slug'
                value={createForm.slug}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                placeholder='plr-masterclass-volume-1'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='book-price'>Base price</Label>
              <Input
                id='book-price'
                type='number'
                min='0'
                value={createForm.basePrice}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    basePrice: event.target.value,
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Primary format</Label>
              <Select
                value={createForm.format}
                onValueChange={(value: string) =>
                  setCreateForm((current) => ({
                    ...current,
                    format: value as any,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select format' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='pdf'>PDF</SelectItem>
                  <SelectItem value='epub'>EPUB</SelectItem>
                  <SelectItem value='mobi'>MOBI</SelectItem>
                  <SelectItem value='azw3'>AZW3</SelectItem>
                  <SelectItem value='html'>HTML</SelectItem>
                  <SelectItem value='audio'>Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='book-description'>Description</Label>
            <Textarea
              id='book-description'
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={4}
              placeholder='Describe the book content, target audience, and licensing notes.'
            />
          </div>

          <div className='grid gap-4 md:grid-cols-2 md:items-end'>
            <div className='space-y-2'>
              <Label>Initial action</Label>
              <Select
                value={createForm.publicationAction}
                onValueChange={(value: string) =>
                  setCreateForm((current) => ({
                    ...current,
                    publicationAction: value as AdminPublicationAction,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select action' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='draft'>Save as draft</SelectItem>
                  <SelectItem value='submit'>Submit for moderation</SelectItem>
                  {canDirectPublish ? (
                    <SelectItem value='publish'>Direct publish</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center gap-3'>
              <Button
                onClick={() => createBookMutation.mutate()}
                disabled={
                  createBookMutation.isPending ||
                  !createForm.name.trim() ||
                  Number(createForm.basePrice) < 0
                }
              >
                {createBookMutation.isPending ? 'Creating...' : 'Create Book'}
              </Button>
              <Badge variant={canDirectPublish ? 'default' : 'secondary'}>
                {canDirectPublish
                  ? 'Role policy: can publish directly'
                  : 'Role policy: moderation required'}
              </Badge>
            </div>
          </div>

          <div className='rounded-xl border p-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-sm font-medium'>Current working book</p>
              <Badge variant={newBookId ? 'default' : 'outline'}>
                {newBookId ? newBookId : 'No book created yet'}
              </Badge>
            </div>

            <div className='mt-4 grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label>Asset type</Label>
                <Select
                  value={uploadForm.assetType}
                  onValueChange={(value: string) =>
                    setUploadForm((current) => ({
                      ...current,
                      assetType: value as any,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='full'>Full</SelectItem>
                    <SelectItem value='sample'>Sample</SelectItem>
                    <SelectItem value='cover'>Cover</SelectItem>
                    <SelectItem value='audio'>Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Format key</Label>
                <Select
                  value={uploadForm.formatKey}
                  onValueChange={(value: string) =>
                    setUploadForm((current) => ({
                      ...current,
                      formatKey: value as any,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select format' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='pdf'>PDF</SelectItem>
                    <SelectItem value='epub'>EPUB</SelectItem>
                    <SelectItem value='mobi'>MOBI</SelectItem>
                    <SelectItem value='azw3'>AZW3</SelectItem>
                    <SelectItem value='html'>HTML</SelectItem>
                    <SelectItem value='audio'>Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='book-files'>Assets</Label>
                <Input
                  id='book-files'
                  type='file'
                  multiple
                  onChange={(event) =>
                    setUploadFiles(Array.from(event.target.files || []))
                  }
                />
              </div>
            </div>

            <div className='mt-4 space-y-2'>
              <Label htmlFor='moderation-notes'>
                Moderation notes (optional)
              </Label>
              <Textarea
                id='moderation-notes'
                value={uploadForm.notes}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                placeholder='Add notes for reviewers or publication audit.'
              />
            </div>

            <div className='mt-4 flex flex-wrap gap-2'>
              <Button
                variant='outline'
                onClick={() => uploadAssetsMutation.mutate()}
                disabled={
                  !newBookId ||
                  uploadFiles.length === 0 ||
                  uploadAssetsMutation.isPending
                }
              >
                <CloudUpload className='mr-2 h-4 w-4' />
                {uploadAssetsMutation.isPending
                  ? 'Uploading...'
                  : 'Upload Assets'}
              </Button>
              <Button
                variant='outline'
                onClick={() => submitBookMutation.mutate()}
                disabled={!newBookId || submitBookMutation.isPending}
              >
                {submitBookMutation.isPending
                  ? 'Submitting...'
                  : 'Submit For Review'}
              </Button>
              {canDirectPublish ? (
                <Button
                  onClick={() => publishBookMutation.mutate()}
                  disabled={!newBookId || publishBookMutation.isPending}
                >
                  {publishBookMutation.isPending
                    ? 'Publishing...'
                    : 'Publish Now'}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            title: 'Submissions in Queue',
            value: queue.length,
            icon: LibraryBig,
            tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
          },
          {
            title: 'Pending Review',
            value: pendingCount,
            icon: Clock3,
            tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
          },
          {
            title: 'Published Books',
            value: publishedCount,
            icon: CheckCircle2,
            tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
          },
          {
            title: 'Needs Attention',
            value: queue.length - pendingCount - publishedCount,
            icon: ShieldAlert,
            tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className='border-muted/60'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.tone}`}>
                  <Icon className='h-4 w-4' />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className='h-8 w-16' />
                ) : (
                  <div className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
                    {stat.value}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Approve a title once the cover, metadata, and distribution formats
            are ready for public launch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          ) : queue.length === 0 ? (
            <div className='rounded-xl border border-dashed p-8 text-center'>
              <BookOpen className='mx-auto h-10 w-10 text-muted-foreground' />
              <h3 className='mt-3 text-lg font-semibold'>
                No books waiting for review
              </h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                When creators submit books for publication, they will appear
                here for moderation.
              </p>
            </div>
          ) : (
            <div className='overflow-hidden rounded-xl border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Formats</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((book) => {
                    const status = getBookStatus(book)
                    const submittedAt =
                      book.submitted_at ||
                      book.submittedAt ||
                      book.updated_at ||
                      book.updatedAt
                    const formats =
                      book.available_formats || book.availableFormats || []

                    return (
                      <TableRow key={book.id}>
                        <TableCell className='font-medium'>
                          {book.title || book.name || 'Untitled'}
                        </TableCell>
                        <TableCell>
                          {book.creator_name ||
                            book.creatorName ||
                            'Unknown creator'}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-2'>
                            {formats.length > 0 ? (
                              formats.map((format) => (
                                <Badge
                                  key={format}
                                  variant='secondary'
                                  className='capitalize'
                                >
                                  {format}
                                </Badge>
                              ))
                            ) : (
                              <span className='text-sm text-muted-foreground'>
                                No formats
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status === 'published'
                                ? 'default'
                                : status === 'rejected'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className='capitalize'
                          >
                            {status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                          {submittedAt
                            ? formatDistanceToNow(new Date(submittedAt), {
                                addSuffix: true,
                              })
                            : 'Recently'}
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='inline-flex gap-2'>
                            <Button
                              size='sm'
                              onClick={() => approveMutation.mutate(book.id)}
                              disabled={approveMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => handleReject(book)}
                              disabled={rejectMutation.isPending}
                            >
                              <ThumbsDown className='mr-2 h-4 w-4' />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

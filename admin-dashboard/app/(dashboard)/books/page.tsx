'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { bookService, type BookReviewQueueItem } from '@/services/books.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  LibraryBig,
  ShieldAlert,
  ThumbsDown,
} from 'lucide-react'

const parseQueue = (response: unknown): BookReviewQueueItem[] => {
  const data = (response as { data?: { data?: unknown } })?.data?.data
  const payload = data as {
    items?: BookReviewQueueItem[]
    books?: BookReviewQueueItem[]
    queue?: BookReviewQueueItem[]
  } | undefined

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
  const queryClient = useQueryClient()

  const { data: queueResponse, isLoading } = useQuery({
    queryKey: ['admin-books-review-queue'],
    queryFn: async () => bookService.getReviewQueue(),
  })

  const queue = useMemo(() => parseQueue(queueResponse), [queueResponse])

  const pendingCount = queue.filter((book) => {
    const status = getBookStatus(book)
    return status === 'pending' || status === 'submitted' || status === 'in_review'
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
            Review incoming books, approve publish-ready titles, and keep the marketplace trust layer tight before listings go public.
          </p>
        </div>
      </div>

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
            Approve a title once the cover, metadata, and distribution formats are ready for public launch.
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
              <h3 className='mt-3 text-lg font-semibold'>No books waiting for review</h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                When creators submit books for publication, they will appear here for moderation.
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
                        <TableCell className='font-medium'>{book.title}</TableCell>
                        <TableCell>
                          {book.creator_name || book.creatorName || 'Unknown creator'}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-2'>
                            {formats.length > 0 ? (
                              formats.map((format) => (
                                <Badge key={format} variant='secondary' className='capitalize'>
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
'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  Phone,
  User,
  Calendar,
  MessageSquare,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Package,
  Copy,
  Trash2,
  RefreshCw,
  Download,
  Eye,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

import contactService, {
  ContactSubmission,
  ContactFilters,
} from '@/services/contact.service'

// Status badge colors
const statusConfig = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  sent: {
    label: 'Sent',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-800',
    icon: AlertCircle,
  },
  bounced: {
    label: 'Bounced',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertCircle,
  },
}

// Subject label mapping
const subjectLabels: Record<string, string> = {
  'Order Inquiry': 'Order',
  'Shipping Question': 'Shipping',
  'Return/Refund Request': 'Return',
  'Billing Issue': 'Billing',
  'Product Question': 'Product',
  'Technical Support': 'Technical',
  'Feedback/Suggestion': 'Feedback',
  'General Inquiry': 'General',
}

export default function ContactMessagesPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ContactFilters>({ page: 1, limit: 20 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMessage, setSelectedMessage] =
    useState<ContactSubmission | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Fetch contact submissions
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contact-submissions', filters],
    queryFn: () => contactService.getSubmissions(filters),
  })

  const submissions = data?.data?.submissions || []
  const pagination = data?.data?.pagination

  // Filter submissions by search term
  const filteredSubmissions = useMemo(() => {
    if (!searchTerm) return submissions
    const term = searchTerm.toLowerCase()
    return submissions.filter(
      (s) =>
        s.recipient_name?.toLowerCase().includes(term) ||
        s.recipient_email?.toLowerCase().includes(term) ||
        s.metadata?.ticketNumber?.toLowerCase().includes(term) ||
        s.metadata?.orderNumber?.toLowerCase().includes(term) ||
        s.metadata?.message?.toLowerCase().includes(term),
    )
  }, [submissions, searchTerm])

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  // Calculate stats from submissions
  const stats = useMemo(() => {
    const total = submissions.length
    const pending = submissions.filter((s) => s.status === 'pending').length
    const sent = submissions.filter((s) => s.status === 'sent').length
    const today = submissions.filter(
      (s) =>
        new Date(s.created_at).toDateString() === new Date().toDateString(),
    ).length

    return { total, pending, sent, today }
  }, [submissions])

  // Format date
  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM d, yyyy h:mm a')
    } catch {
      return date
    }
  }

  // Get relative time
  const getRelativeTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return ''
    }
  }

  // Export to CSV
  const handleExport = () => {
    const headers = [
      'Ticket #',
      'Name',
      'Email',
      'Phone',
      'Subject',
      'Order #',
      'Message',
      'Status',
      'Date',
    ]
    const csvData = submissions.map((s) => [
      s.metadata?.ticketNumber || '',
      s.recipient_name || '',
      s.recipient_email || '',
      s.metadata?.phone || '',
      s.subject || '',
      s.metadata?.orderNumber || '',
      s.metadata?.message?.replace(/"/g, '""') || '',
      s.status || '',
      formatDate(s.created_at),
    ])

    const csv = [
      headers.join(','),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contact-messages-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Contact messages exported')
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Contact Messages
          </h1>
          <p className='text-muted-foreground'>
            View and manage customer contact form submissions
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => refetch()}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Refresh
          </Button>
          <Button variant='outline' onClick={handleExport}>
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Messages
            </CardTitle>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total}</div>
            <p className='text-xs text-muted-foreground'>All submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Pending</CardTitle>
            <Clock className='h-4 w-4 text-yellow-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-600'>
              {stats.pending}
            </div>
            <p className='text-xs text-muted-foreground'>Awaiting response</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Responded</CardTitle>
            <CheckCircle className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {stats.sent}
            </div>
            <p className='text-xs text-muted-foreground'>Emails sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Today</CardTitle>
            <Calendar className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-blue-600'>
              {stats.today}
            </div>
            <p className='text-xs text-muted-foreground'>New today</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='relative w-full md:w-96'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search by name, email, ticket #, or message...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>
            <div className='flex gap-2'>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value: string) =>
                  setFilters((f) => ({
                    ...f,
                    status: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger className='w-35'>
                  <Filter className='mr-2 h-4 w-4' />
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='pending'>Pending</SelectItem>
                  <SelectItem value='sent'>Sent</SelectItem>
                  <SelectItem value='failed'>Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex h-64 items-center justify-center'>
              <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : error ? (
            <div className='flex h-64 flex-col items-center justify-center text-muted-foreground'>
              <AlertCircle className='mb-2 h-8 w-8' />
              <p>Failed to load messages</p>
              <Button
                variant='ghost'
                onClick={() => refetch()}
                className='mt-2'
              >
                Try again
              </Button>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className='flex h-64 flex-col items-center justify-center text-muted-foreground'>
              <MessageSquare className='mb-2 h-8 w-8' />
              <p>No contact messages found</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {/* Messages List */}
              {filteredSubmissions.map((submission) => {
                const metadata = submission.metadata || {}
                const isExpanded = expandedRow === submission.id
                const StatusIcon =
                  statusConfig[submission.status]?.icon || Clock

                return (
                  <Card
                    key={submission.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isExpanded ? 'ring-2 ring-orange-500' : ''
                    }`}
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : submission.id)
                    }
                  >
                    <CardContent className='p-4'>
                      {/* Summary Row */}
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex-1 space-y-1'>
                          <div className='flex items-center gap-3'>
                            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-orange-100'>
                              <User className='h-5 w-5 text-orange-600' />
                            </div>
                            <div>
                              <div className='flex items-center gap-2'>
                                <span className='font-semibold'>
                                  {submission.recipient_name}
                                </span>
                                <Badge variant='outline' className='text-xs'>
                                  {metadata.ticketNumber || 'N/A'}
                                </Badge>
                              </div>
                              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                <Mail className='h-3 w-3' />
                                {submission.recipient_email}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center gap-4'>
                          <Badge
                            className={`${
                              statusConfig[submission.status]?.color ||
                              'bg-gray-100'
                            }`}
                          >
                            <StatusIcon className='mr-1 h-3 w-3' />
                            {statusConfig[submission.status]?.label ||
                              submission.status}
                          </Badge>
                          <div className='text-right text-sm text-muted-foreground'>
                            <div>{getRelativeTime(submission.created_at)}</div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className='h-5 w-5 text-muted-foreground' />
                          ) : (
                            <ChevronDown className='h-5 w-5 text-muted-foreground' />
                          )}
                        </div>
                      </div>

                      {/* Subject Preview */}
                      <div className='mt-2 flex items-center gap-2'>
                        <Badge variant='secondary'>
                          {subjectLabels[submission.subject] ||
                            submission.subject}
                        </Badge>
                        {metadata.orderNumber && (
                          <Badge variant='outline' className='text-xs'>
                            <Package className='mr-1 h-3 w-3' />
                            Order: {metadata.orderNumber}
                          </Badge>
                        )}
                      </div>

                      {/* Message Preview */}
                      {!isExpanded && metadata.message && (
                        <p className='mt-2 line-clamp-1 text-sm text-muted-foreground'>
                          {metadata.message}
                        </p>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className='mt-4 space-y-4 border-t pt-4'>
                          {/* Contact Info */}
                          <div className='grid gap-4 md:grid-cols-3'>
                            <div className='space-y-1'>
                              <label className='text-xs font-medium text-muted-foreground'>
                                Email
                              </label>
                              <div className='flex items-center gap-2'>
                                <span className='text-sm'>
                                  {submission.recipient_email}
                                </span>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='h-6 w-6'
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyToClipboard(
                                      submission.recipient_email,
                                      'Email',
                                    )
                                  }}
                                >
                                  <Copy className='h-3 w-3' />
                                </Button>
                              </div>
                            </div>
                            {metadata.phone && (
                              <div className='space-y-1'>
                                <label className='text-xs font-medium text-muted-foreground'>
                                  Phone
                                </label>
                                <div className='flex items-center gap-2'>
                                  <Phone className='h-4 w-4 text-muted-foreground' />
                                  <span className='text-sm'>
                                    {metadata.phone}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className='space-y-1'>
                              <label className='text-xs font-medium text-muted-foreground'>
                                Submitted
                              </label>
                              <div className='text-sm'>
                                {formatDate(submission.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Full Message */}
                          <div className='space-y-2'>
                            <label className='text-xs font-medium text-muted-foreground'>
                              Message
                            </label>
                            <div className='rounded-lg bg-muted/50 p-4'>
                              <p className='whitespace-pre-wrap text-sm'>
                                {metadata.message}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className='flex items-center gap-2 pt-2'>
                            <Button
                              variant='default'
                              size='sm'
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `mailto:${submission.recipient_email}?subject=Re: ${submission.subject} - ${metadata.ticketNumber}`
                              }}
                            >
                              <Mail className='mr-2 h-4 w-4' />
                              Reply via Email
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(
                                  metadata.ticketNumber || '',
                                  'Ticket number',
                                )
                              }}
                            >
                              <Copy className='mr-2 h-4 w-4' />
                              Copy Ticket #
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className='flex items-center justify-between pt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    )}{' '}
                    of {pagination.total} messages
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={pagination.page <= 1}
                      onClick={() =>
                        setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() =>
                        setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

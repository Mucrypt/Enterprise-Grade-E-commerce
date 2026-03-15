'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  RefreshCw,
  Download,
  Send,
  ExternalLink,
  Reply,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

import contactService, {
  ContactSubmission,
  ContactFilters,
} from '@/services/contact.service'

// Status badge colors
const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock,
  },
  sent: {
    label: 'Replied',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle,
  },
  bounced: {
    label: 'Bounced',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
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

// Subject to department email mapping
const subjectEmailMap: Record<string, string> = {
  'Order Inquiry': 'orders@techtoolstore.com',
  'Shipping Question': 'orders@techtoolstore.com',
  'Return/Refund Request': 'returns@techtoolstore.com',
  'Billing Issue': 'billing@techtoolstore.com',
  'Product Question': 'support@techtoolstore.com',
  'Technical Support': 'support@techtoolstore.com',
  'Feedback/Suggestion': 'support@techtoolstore.com',
  'General Inquiry': 'support@techtoolstore.com',
}

// Reply templates
const replyTemplates = [
  {
    name: 'Thank You',
    body: `Dear {name},

Thank you for contacting TechTools! We have received your message and appreciate you reaching out.

{custom_response}

If you have any further questions, please don't hesitate to contact us.

Best regards,
TechTools Support Team`,
  },
  {
    name: 'Order Status',
    body: `Dear {name},

Thank you for contacting us about your order{order_number}.

{custom_response}

You can track your order status at: https://techtoolstore.com/orders

If you need any further assistance, please reply to this email.

Best regards,
TechTools Orders Team`,
  },
  {
    name: 'Return/Refund',
    body: `Dear {name},

Thank you for contacting us regarding your return/refund request.

{custom_response}

Our return policy allows returns within 30 days of purchase for most items. Please ensure the item is in its original packaging.

If you have any questions, please don't hesitate to ask.

Best regards,
TechTools Returns Team`,
  },
  {
    name: 'Custom',
    body: `Dear {name},

{custom_response}

Best regards,
TechTools Support Team`,
  },
]

export default function ContactMessagesPage() {
  const [filters, setFilters] = useState<ContactFilters>({ page: 1, limit: 50 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMessage, setSelectedMessage] =
    useState<ContactSubmission | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [replyDialogOpen, setReplyDialogOpen] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('Custom')

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

  // Open reply dialog
  const openReplyDialog = (submission: ContactSubmission) => {
    setSelectedMessage(submission)
    setSelectedTemplate('Custom')
    // Pre-populate with Custom template
    const customTemplate = `Dear ${submission.recipient_name || 'Customer'},

[Type your response here]

Best regards,
TechTools Support Team`
    setReplyContent(customTemplate)
    setReplyDialogOpen(true)
  }

  // Apply template
  const applyTemplate = (templateName: string) => {
    const template = replyTemplates.find((t) => t.name === templateName)
    if (template && selectedMessage) {
      let body = template.body
        .replace('{name}', selectedMessage.recipient_name || 'Customer')
        .replace(
          '{order_number}',
          selectedMessage.metadata?.orderNumber
            ? ` #${selectedMessage.metadata.orderNumber}`
            : '',
        )
        .replace('{custom_response}', '[Type your response here]')
      setReplyContent(body)
    }
    setSelectedTemplate(templateName)
  }

  // Generate mailto link for reply
  const getReplyMailtoLink = (submission: ContactSubmission) => {
    const metadata = submission.metadata || {}
    const fromEmail =
      subjectEmailMap[submission.subject] || 'support@techtoolstore.com'
    const subject = encodeURIComponent(
      `Re: ${submission.subject} - ${metadata.ticketNumber || ''}`,
    )
    const body = encodeURIComponent(replyContent)
    return `mailto:${submission.recipient_email}?subject=${subject}&body=${body}`
  }

  // Open in Hostinger Webmail
  const openHostingerWebmail = () => {
    window.open('https://mail.hostinger.com', '_blank')
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

  // Copy message details for Hostinger reply
  const copyForHostinger = (submission: ContactSubmission) => {
    const metadata = submission.metadata || {}
    const text = `TO: ${submission.recipient_email}
SUBJECT: Re: ${submission.subject} - ${metadata.ticketNumber || ''}

---

ORIGINAL MESSAGE:
From: ${submission.recipient_name} <${submission.recipient_email}>
${metadata.phone ? `Phone: ${metadata.phone}` : ''}
${metadata.orderNumber ? `Order: ${metadata.orderNumber}` : ''}
Subject: ${submission.subject}
Date: ${formatDate(submission.created_at)}

${metadata.message || ''}

---

YOUR REPLY:
Dear ${submission.recipient_name},

[Type your response here]

Best regards,
TechTools Support Team`

    navigator.clipboard.writeText(text)
    toast.success('Message copied! Open Hostinger Webmail to reply')
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
            View and respond to customer inquiries
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={openHostingerWebmail}>
            <ExternalLink className='mr-2 h-4 w-4' />
            Hostinger Mail
          </Button>
          <Button variant='outline' onClick={() => refetch()}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Refresh
          </Button>
          <Button variant='outline' onClick={handleExport}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total</CardTitle>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total}</div>
          </CardContent>
        </Card>
        <Card className='border-yellow-200 bg-yellow-50/50'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium text-yellow-800'>
              Pending
            </CardTitle>
            <Clock className='h-4 w-4 text-yellow-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-700'>
              {stats.pending}
            </div>
          </CardContent>
        </Card>
        <Card className='border-green-200 bg-green-50/50'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium text-green-800'>
              Replied
            </CardTitle>
            <CheckCircle className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-700'>
              {stats.sent}
            </div>
          </CardContent>
        </Card>
        <Card className='border-blue-200 bg-blue-50/50'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium text-blue-800'>
              Today
            </CardTitle>
            <Calendar className='h-4 w-4 text-blue-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-blue-700'>
              {stats.today}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search by name, email, ticket, or message...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='pl-10'
          />
        </div>
        <Select
          value={filters.status || 'all'}
          onValueChange={(value: string) =>
            setFilters((f) => ({
              ...f,
              status: value === 'all' ? undefined : value,
            }))
          }
        >
          <SelectTrigger className='w-37.5'>
            <Filter className='mr-2 h-4 w-4' />
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Status</SelectItem>
            <SelectItem value='pending'>Pending</SelectItem>
            <SelectItem value='sent'>Replied</SelectItem>
            <SelectItem value='failed'>Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Messages List */}
      <div className='space-y-3'>
        {isLoading ? (
          <div className='flex h-64 items-center justify-center'>
            <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : error ? (
          <Card className='p-8 text-center'>
            <AlertCircle className='mx-auto mb-2 h-8 w-8 text-red-500' />
            <p>Failed to load messages</p>
            <Button variant='ghost' onClick={() => refetch()} className='mt-2'>
              Try again
            </Button>
          </Card>
        ) : filteredSubmissions.length === 0 ? (
          <Card className='p-8 text-center'>
            <MessageSquare className='mx-auto mb-2 h-8 w-8 text-muted-foreground' />
            <p className='text-muted-foreground'>No contact messages found</p>
          </Card>
        ) : (
          filteredSubmissions.map((submission) => {
            const metadata = submission.metadata || {}
            const isExpanded = expandedRow === submission.id
            const StatusIcon = statusConfig[submission.status]?.icon || Clock
            const statusStyle =
              statusConfig[submission.status] || statusConfig.pending

            return (
              <Card
                key={submission.id}
                className={`transition-all ${
                  isExpanded
                    ? 'ring-2 ring-orange-500 shadow-lg'
                    : 'hover:shadow-md'
                } ${
                  submission.status === 'pending'
                    ? 'border-l-4 border-l-yellow-400'
                    : ''
                }`}
              >
                <CardContent className='p-0'>
                  {/* Clickable Header */}
                  <div
                    className='flex cursor-pointer items-center justify-between p-4'
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : submission.id)
                    }
                  >
                    <div className='flex items-center gap-4'>
                      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-semibold'>
                        {submission.recipient_name?.charAt(0)?.toUpperCase() ||
                          'U'}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-semibold text-lg'>
                            {submission.recipient_name}
                          </span>
                          <Badge
                            variant='outline'
                            className='font-mono text-xs'
                          >
                            {metadata.ticketNumber || 'N/A'}
                          </Badge>
                          <Badge className={statusStyle.color}>
                            <StatusIcon className='mr-1 h-3 w-3' />
                            {statusStyle.label}
                          </Badge>
                        </div>
                        <div className='flex items-center gap-3 text-sm text-muted-foreground'>
                          <span className='flex items-center gap-1'>
                            <Mail className='h-3 w-3' />
                            {submission.recipient_email}
                          </span>
                          <span>•</span>
                          <span>{getRelativeTime(submission.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='secondary'>
                        {subjectLabels[submission.subject] ||
                          submission.subject}
                      </Badge>
                      {metadata.orderNumber && (
                        <Badge variant='outline'>
                          <Package className='mr-1 h-3 w-3' />
                          {metadata.orderNumber}
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className='h-5 w-5' />
                      ) : (
                        <ChevronDown className='h-5 w-5' />
                      )}
                    </div>
                  </div>

                  {/* Message Preview (collapsed) */}
                  {!isExpanded && metadata.message && (
                    <div className='border-t bg-muted/30 px-4 py-2'>
                      <p className='line-clamp-1 text-sm text-muted-foreground'>
                        {metadata.message}
                      </p>
                    </div>
                  )}

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className='border-t'>
                      {/* Contact Details */}
                      <div className='grid gap-4 bg-muted/30 p-4 md:grid-cols-4'>
                        <div>
                          <Label className='text-xs text-muted-foreground'>
                            Email
                          </Label>
                          <div className='flex items-center gap-1'>
                            <span className='text-sm font-medium'>
                              {submission.recipient_email}
                            </span>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-6 w-6'
                              onClick={() =>
                                copyToClipboard(
                                  submission.recipient_email,
                                  'Email',
                                )
                              }
                            >
                              <Copy className='h-3 w-3' />
                            </Button>
                          </div>
                        </div>
                        {metadata.phone && (
                          <div>
                            <Label className='text-xs text-muted-foreground'>
                              Phone
                            </Label>
                            <div className='flex items-center gap-1'>
                              <Phone className='h-3 w-3' />
                              <span className='text-sm font-medium'>
                                {metadata.phone}
                              </span>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-6 w-6'
                                onClick={() =>
                                  copyToClipboard(metadata.phone!, 'Phone')
                                }
                              >
                                <Copy className='h-3 w-3' />
                              </Button>
                            </div>
                          </div>
                        )}
                        {metadata.orderNumber && (
                          <div>
                            <Label className='text-xs text-muted-foreground'>
                              Order Number
                            </Label>
                            <span className='text-sm font-medium'>
                              {metadata.orderNumber}
                            </span>
                          </div>
                        )}
                        <div>
                          <Label className='text-xs text-muted-foreground'>
                            Received
                          </Label>
                          <span className='text-sm font-medium'>
                            {formatDate(submission.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className='p-4'>
                        <Label className='text-xs text-muted-foreground'>
                          Customer Message
                        </Label>
                        <div className='mt-2 rounded-lg border bg-white p-4'>
                          <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                            {metadata.message}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Action Buttons */}
                      <div className='flex flex-wrap items-center gap-2 p-4'>
                        <Button onClick={() => openReplyDialog(submission)}>
                          <Reply className='mr-2 h-4 w-4' />
                          Compose Reply
                        </Button>
                        <Button
                          variant='outline'
                          onClick={() => {
                            copyForHostinger(submission)
                            openHostingerWebmail()
                          }}
                        >
                          <ExternalLink className='mr-2 h-4 w-4' />
                          Reply in Hostinger
                        </Button>
                        <Button
                          variant='outline'
                          onClick={() =>
                            copyToClipboard(submission.recipient_email, 'Email')
                          }
                        >
                          <Copy className='mr-2 h-4 w-4' />
                          Copy Email
                        </Button>
                        <Button
                          variant='outline'
                          onClick={() =>
                            copyToClipboard(
                              metadata.ticketNumber || '',
                              'Ticket',
                            )
                          }
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
          })
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className='flex items-center justify-between pt-4'>
            <p className='text-sm text-muted-foreground'>
              Page {pagination.page} of {pagination.totalPages} (
              {pagination.total} messages)
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

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className='max-w-2xl overflow-hidden'>
          <DialogHeader>
            <DialogTitle>
              Reply to {selectedMessage?.recipient_name}
            </DialogTitle>
            <DialogDescription>
              Compose your reply. You can use templates or write a custom
              response.
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className='space-y-4 w-full overflow-hidden'>
              {/* Original Message Summary */}
              <div className='rounded-lg border bg-muted/50 p-3 overflow-hidden'>
                <div className='flex flex-wrap items-center gap-2 text-sm'>
                  <Badge variant='outline' className='shrink-0'>
                    {selectedMessage.metadata?.ticketNumber}
                  </Badge>
                  <span className='text-muted-foreground'>•</span>
                  <span className='truncate'>{selectedMessage.subject}</span>
                </div>
                <p className='mt-2 line-clamp-2 text-sm text-muted-foreground wrap-break-word'>
                  {selectedMessage.metadata?.message}
                </p>
              </div>

              {/* Template Selection */}
              <div>
                <Label>Reply Template</Label>
                <Select value={selectedTemplate} onValueChange={applyTemplate}>
                  <SelectTrigger className='mt-1'>
                    <SelectValue placeholder='Select template' />
                  </SelectTrigger>
                  <SelectContent>
                    {replyTemplates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reply Content */}
              <div className='w-full'>
                <Label>Your Reply</Label>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder='Type your response here...'
                  className='mt-1 min-h-48 w-full resize-none font-mono text-sm'
                />
              </div>

              {/* Send Options */}
              <div className='rounded-lg border border-blue-200 bg-blue-50 p-3'>
                <p className='text-sm text-blue-800'>
                  <strong>Send:</strong> Copy your reply and open Hostinger or
                  your email app to send.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className='flex flex-wrap gap-2 justify-end'>
            <Button variant='outline' onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                if (selectedMessage) {
                  navigator.clipboard.writeText(replyContent)
                  toast.success('Reply copied!')
                }
              }}
            >
              <Copy className='mr-2 h-4 w-4' />
              Copy
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                if (selectedMessage) {
                  navigator.clipboard.writeText(replyContent)
                  openHostingerWebmail()
                  toast.success('Reply copied! Paste it in Hostinger')
                }
              }}
            >
              <ExternalLink className='mr-2 h-4 w-4' />
              Hostinger
            </Button>
            <Button
              onClick={() => {
                if (selectedMessage) {
                  window.location.href = getReplyMailtoLink(selectedMessage)
                }
              }}
            >
              <Send className='mr-2 h-4 w-4' />
              Email App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

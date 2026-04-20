'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import emailService, {
  EmailFilters,
  EmailMessage,
} from '@/services/email.service'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Search,
  RefreshCw,
  Send,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  RotateCw,
  Settings,
  FileText,
  AlertCircle,
  MailOpen,
  Ban,
  AtSign,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useDebounce } from '@/hooks/useDebounce'

// =====================================================
// Stats Cards Component
// =====================================================

function StatsCards() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['email-stats'],
    queryFn: () => emailService.getStats(),
  })

  const stats = statsData?.data?.stats

  if (isLoading) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-4 w-4' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-20' />
              <Skeleton className='h-3 w-32 mt-2' />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Total Emails</CardTitle>
          <Mail className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats?.total || 0}</div>
          <p className='text-xs text-muted-foreground'>
            {stats?.todayCount || 0} sent today
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Delivered</CardTitle>
          <CheckCircle2 className='h-4 w-4 text-green-500' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats?.delivered || 0}</div>
          <p className='text-xs text-muted-foreground'>
            {stats?.total
              ? ((stats.delivered / stats.total) * 100).toFixed(1)
              : 0}
            % delivery rate
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Sent</CardTitle>
          <Send className='h-4 w-4 text-blue-500' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats?.sent || 0}</div>
          <p className='text-xs text-muted-foreground'>
            {stats?.weekCount || 0} this week
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Failed</CardTitle>
          <XCircle className='h-4 w-4 text-red-500' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>
            {(stats?.failed || 0) + (stats?.bounced || 0)}
          </div>
          <p className='text-xs text-muted-foreground'>
            {stats?.bounced || 0} bounced
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// Send Email Dialog
// =====================================================

function SendEmailDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [toName, setToName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: (data: {
      to: string
      toName?: string
      subject: string
      html: string
    }) => emailService.sendEmail(data),
    onSuccess: () => {
      toast.success('Email sent successfully')
      queryClient.invalidateQueries({ queryKey: ['email-messages'] })
      queryClient.invalidateQueries({ queryKey: ['email-stats'] })
      setOpen(false)
      setEmail('')
      setToName('')
      setSubject('')
      setMessage('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to send email')
    },
  })

  const handleSend = () => {
    if (!email || !subject || !message) {
      toast.error('Please enter email, subject, and message')
      return
    }
    sendMutation.mutate({
      to: email,
      toName: toName || undefined,
      subject,
      html: message.replace(/\n/g, '<br/>'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className='mr-2 h-4 w-4' />
          Send Email
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-150'>
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Send a custom email to a customer.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                placeholder='customer@example.com'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='toName'>Recipient Name (optional)</Label>
              <Input
                id='toName'
                placeholder='John Doe'
                value={toName}
                onChange={(e) => setToName(e.target.value)}
              />
            </div>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='subject'>Subject</Label>
            <Input
              id='subject'
              placeholder='Email subject...'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='message'>Message</Label>
            <Textarea
              id='message'
              placeholder='Type your message here...'
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Line breaks will be converted to HTML breaks.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sendMutation.isPending}>
            {sendMutation.isPending ? (
              <>
                <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                Sending...
              </>
            ) : (
              <>
                <Send className='mr-2 h-4 w-4' />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Email Details Dialog
// =====================================================

function EmailDetailsDialog({ email: emailMsg }: { email: EmailMessage }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='sm'>
          <Eye className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-150'>
        <DialogHeader>
          <DialogTitle>Email Details</DialogTitle>
        </DialogHeader>
        <div className='space-y-4 max-h-[70vh] overflow-y-auto'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label className='text-muted-foreground'>Recipient</Label>
              <p className='font-medium'>{emailMsg.recipient_email}</p>
              {emailMsg.recipient_name && (
                <p className='text-sm text-muted-foreground'>
                  {emailMsg.recipient_name}
                </p>
              )}
            </div>
            <div>
              <Label className='text-muted-foreground'>Status</Label>
              <div className='mt-1'>
                <StatusBadge status={emailMsg.status} />
              </div>
            </div>
            <div>
              <Label className='text-muted-foreground'>Type</Label>
              <p className='font-medium capitalize'>
                {emailMsg.email_type.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <Label className='text-muted-foreground'>Sent</Label>
              <p className='font-medium'>
                {format(new Date(emailMsg.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            {emailMsg.order_number && (
              <div>
                <Label className='text-muted-foreground'>Order</Label>
                <p className='font-medium'>#{emailMsg.order_number}</p>
              </div>
            )}
            {emailMsg.from_email && (
              <div>
                <Label className='text-muted-foreground'>From</Label>
                <p className='font-medium'>{emailMsg.from_email}</p>
              </div>
            )}
            {emailMsg.metadata?.channel && (
              <div>
                <Label className='text-muted-foreground'>Channel</Label>
                <p className='font-medium capitalize'>
                  {String(emailMsg.metadata.channel).replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </div>
          <div>
            <Label className='text-muted-foreground'>Subject</Label>
            <p className='font-medium mt-1'>{emailMsg.subject}</p>
          </div>
          <div>
            <Label className='text-muted-foreground'>Content</Label>
            <div
              className='mt-2 p-3 bg-muted rounded-lg text-sm prose prose-sm max-w-none'
              dangerouslySetInnerHTML={{
                __html: emailMsg.body_html || emailMsg.body_text || '',
              }}
            />
          </div>
          {emailMsg.error_message && (
            <div>
              <Label className='text-red-500'>Error</Label>
              <p className='text-sm text-red-500'>{emailMsg.error_message}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Status Badge Component
// =====================================================

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }
  > = {
    pending: { variant: 'outline', icon: Clock },
    sent: { variant: 'secondary', icon: Send },
    delivered: { variant: 'default', icon: CheckCircle2 },
    bounced: { variant: 'destructive', icon: Ban },
    failed: { variant: 'destructive', icon: XCircle },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className='gap-1'>
      <Icon className='h-3 w-3' />
      {status}
    </Badge>
  )
}

// =====================================================
// Messages Table
// =====================================================

function MessagesTable({
  includeInternal = false,
  title = 'Emails',
  description = 'View and manage emails sent to customers.',
  emptyTitle = 'No emails yet',
  emptyDescription = 'Emails will appear here when orders are placed.',
}: {
  includeInternal?: boolean
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
}) {
  const [filters, setFilters] = useState<EmailFilters>({
    page: 1,
    limit: 20,
    includeInternal,
  })
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)
  const queryClient = useQueryClient()

  // Update search filter when debounced value changes
  const activeFilters = useMemo(
    () => ({
      ...filters,
      includeInternal,
      search: debouncedSearch || undefined,
    }),
    [filters, debouncedSearch, includeInternal],
  )

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-messages', activeFilters],
    queryFn: () => emailService.getMessages(activeFilters),
  })

  const resendMutation = useMutation({
    mutationFn: (id: string) => emailService.resendEmail(id),
    onSuccess: () => {
      toast.success('Email resent successfully')
      queryClient.invalidateQueries({ queryKey: ['email-messages'] })
      queryClient.invalidateQueries({ queryKey: ['email-stats'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to resend email')
    },
  })

  const messages = data?.data?.messages || []
  const pagination = data?.data?.pagination

  const handleStatusFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      status: value === 'all' ? undefined : value,
      page: 1,
    }))
  }

  const handleTypeFilter = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      emailType: value === 'all' ? undefined : value,
      page: 1,
    }))
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='h-4 w-4' />
            </Button>
            <SendEmailDialog />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className='flex flex-col gap-4 mb-4 md:flex-row md:items-center'>
          <div className='relative flex-1'>
            <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search by email or subject...'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className='pl-8'
            />
          </div>
          <Select
            value={filters.status || 'all'}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className='w-37.5'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Statuses</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
              <SelectItem value='sent'>Sent</SelectItem>
              <SelectItem value='delivered'>Delivered</SelectItem>
              <SelectItem value='bounced'>Bounced</SelectItem>
              <SelectItem value='failed'>Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.emailType || 'all'}
            onValueChange={handleTypeFilter}
          >
            <SelectTrigger className='w-45'>
              <SelectValue placeholder='Type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Types</SelectItem>
              <SelectItem value='order_confirmation'>
                Order Confirmation
              </SelectItem>
              <SelectItem value='order_status'>Order Status</SelectItem>
              <SelectItem value='shipping_update'>Shipping Update</SelectItem>
              <SelectItem value='delivery_confirmation'>Delivery</SelectItem>
              <SelectItem value='welcome'>Welcome</SelectItem>
              <SelectItem value='password_reset'>Password Reset</SelectItem>
              <SelectItem value='verification'>Verification</SelectItem>
              <SelectItem value='promotional'>Promotional</SelectItem>
              <SelectItem value='custom'>Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className='space-y-3'>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <Mail className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-medium'>{emptyTitle}</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              {emptyDescription}
            </p>
            <SendEmailDialog />
          </div>
        ) : (
          <>
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className='w-25'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((emailMsg: EmailMessage) => (
                    <TableRow key={emailMsg.id}>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <AtSign className='h-4 w-4 text-muted-foreground' />
                          <span className='text-sm truncate max-w-40'>
                            {emailMsg.recipient_email}
                          </span>
                        </div>
                        {emailMsg.recipient_name && (
                          <p className='text-xs text-muted-foreground'>
                            {emailMsg.recipient_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className='text-sm truncate max-w-50 block'>
                          {emailMsg.subject}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='capitalize text-xs'>
                          {emailMsg.email_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emailMsg.status} />
                      </TableCell>
                      <TableCell>
                        {format(new Date(emailMsg.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <EmailDetailsDialog email={emailMsg} />
                          {(emailMsg.status === 'failed' ||
                            emailMsg.status === 'bounced') && (
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => resendMutation.mutate(emailMsg.id)}
                              disabled={resendMutation.isPending}
                            >
                              <RotateCw className='h-4 w-4' />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className='flex items-center justify-between mt-4'>
                <p className='text-sm text-muted-foreground'>
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{' '}
                  of {pagination.total} emails
                </p>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: (prev.page || 1) - 1,
                      }))
                    }
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <span className='text-sm'>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: (prev.page || 1) + 1,
                      }))
                    }
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
  )
}

// =====================================================
// Settings Tab
// =====================================================

function SettingsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => emailService.getSettings(),
  })

  const settings = data?.data?.settings
  const isConfigured = data?.data?.isConfigured

  if (isLoading) {
    return <Skeleton className='h-100 w-full' />
  }

  return (
    <div className='space-y-6'>
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='h-5 w-5' />
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4'>
            <div
              className={`p-3 rounded-full ${
                isConfigured ? 'bg-green-100' : 'bg-yellow-100'
              }`}
            >
              {isConfigured ? (
                <CheckCircle2 className='h-6 w-6 text-green-600' />
              ) : (
                <AlertCircle className='h-6 w-6 text-yellow-600' />
              )}
            </div>
            <div>
              <p className='font-medium'>
                {isConfigured
                  ? 'Email is configured'
                  : 'Email needs configuration'}
              </p>
              <p className='text-sm text-muted-foreground'>
                SMTP Provider: {isConfigured ? 'Configured' : 'Not set'}
              </p>
            </div>
          </div>

          {!isConfigured && (
            <div className='mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
              <h4 className='font-medium text-yellow-800 mb-2'>
                Setup Required
              </h4>
              <p className='text-sm text-yellow-700 mb-3'>
                To enable email notifications, add these environment variables
                to your server:
              </p>
              <pre className='bg-yellow-100 p-3 rounded text-xs overflow-x-auto'>
                {`# SMTP Configuration (Hostinger example)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@techtoolstore.com
SMTP_PASS=your_email_password

# Email Settings
SMTP_FROM=noreply@techtoolstore.com
EMAIL_FROM_NAME=TechTools Store
ADMIN_NOTIFICATION_EMAILS=admin@techtoolstore.com
INTERNAL_NOTIFICATION_EMAILS=support@techtoolstore.com,orders@techtoolstore.com
ADMIN_DASHBOARD_URL=https://techtoolstore.com/admin/dashboard`}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Control which notifications are sent via email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {settings &&
              Object.entries(settings).map(([key, value]) => (
                <div
                  key={key}
                  className='flex items-center justify-between py-2 border-b last:border-0'
                >
                  <div>
                    <p className='font-medium capitalize'>
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {value.description}
                    </p>
                  </div>
                  <Badge
                    variant={value.value === 'true' ? 'default' : 'secondary'}
                  >
                    {value.value === 'true' ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            {(!settings || Object.keys(settings).length === 0) && (
              <p className='text-muted-foreground text-sm'>
                No settings configured yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// Templates Tab
// =====================================================

function TemplatesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailService.getTemplates(),
  })

  const templates = data?.data?.templates || []

  if (isLoading) {
    return <Skeleton className='h-100 w-full' />
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Email Templates
            </CardTitle>
            <CardDescription>
              Pre-defined email templates for automated sending.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className='text-center py-8'>
            <FileText className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
            <p className='text-muted-foreground'>No templates found</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {templates.map((template) => (
              <div key={template.id} className='border rounded-lg p-4'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='flex items-center gap-2'>
                    <h4 className='font-medium'>{template.name}</h4>
                    <Badge
                      variant={template.is_active ? 'default' : 'secondary'}
                    >
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <code className='text-xs bg-muted px-2 py-1 rounded'>
                    {template.template_key}
                  </code>
                </div>
                <div className='mb-2'>
                  <Label className='text-muted-foreground text-xs'>
                    Subject:
                  </Label>
                  <p className='text-sm'>{template.subject}</p>
                </div>
                <div
                  className='bg-muted p-3 rounded-lg text-sm prose prose-sm max-w-none max-h-40 overflow-y-auto'
                  dangerouslySetInnerHTML={{ __html: template.body_html }}
                />
                {template.variables && template.variables.length > 0 && (
                  <div className='mt-2 flex gap-1 flex-wrap'>
                    {template.variables.map((v: string) => (
                      <Badge key={v} variant='outline' className='text-xs'>
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Main Page Component
// =====================================================

export default function EmailPage() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Email Notifications
          </h1>
          <p className='text-muted-foreground'>
            Manage customer communications and internal operational alerts from
            one console.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className='space-y-2'>
        <StatsCards />
        <p className='text-sm text-muted-foreground'>
          Summary metrics track customer-facing email delivery. Internal alerts
          are managed in their own tab below.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='messages' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='messages'>
            <Mail className='mr-2 h-4 w-4' />
            Customer Emails
          </TabsTrigger>
          <TabsTrigger value='internal-alerts'>
            <ShieldAlert className='mr-2 h-4 w-4' />
            Internal Alerts
          </TabsTrigger>
          <TabsTrigger value='templates'>
            <FileText className='mr-2 h-4 w-4' />
            Templates
          </TabsTrigger>
          <TabsTrigger value='settings'>
            <Settings className='mr-2 h-4 w-4' />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value='messages'>
          <MessagesTable />
        </TabsContent>

        <TabsContent value='internal-alerts'>
          <MessagesTable
            includeInternal={true}
            title='Internal Alerts'
            description='Monitor admin alert emails, support routing, and internal delivery failures.'
            emptyTitle='No internal alerts yet'
            emptyDescription='Newsletter, contact, and internal workflow alerts will appear here.'
          />
        </TabsContent>

        <TabsContent value='templates'>
          <TemplatesTab />
        </TabsContent>

        <TabsContent value='settings'>
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

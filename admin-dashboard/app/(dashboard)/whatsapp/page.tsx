'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import whatsappService, { WhatsAppFilters, WhatsAppMessage } from '@/services/whatsapp.service'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Search,
  MoreHorizontal,
  RefreshCw,
  Send,
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  RotateCw,
  Phone,
  Settings,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useDebounce } from '@/hooks/useDebounce'

// =====================================================
// Stats Cards Component
// =====================================================

function StatsCards() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['whatsapp-stats'],
    queryFn: () => whatsappService.getStats(),
  })

  const stats = statsData?.data?.stats

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.todayCount || 0} sent today
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Delivered</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.delivered || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.total ? ((stats.delivered / stats.total) * 100).toFixed(1) : 0}% delivery rate
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Read</CardTitle>
          <Eye className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.read || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.delivered ? ((stats.read / stats.delivered) * 100).toFixed(1) : 0}% read rate
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.failed || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.weekCount || 0} this week
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// Send Message Dialog
// =====================================================

function SendMessageDialog() {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: (data: { recipientPhone: string; message: string }) =>
      whatsappService.sendMessage(data),
    onSuccess: () => {
      toast.success('WhatsApp message sent successfully')
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-stats'] })
      setOpen(false)
      setPhone('')
      setMessage('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to send message')
    },
  })

  const handleSend = () => {
    if (!phone || !message) {
      toast.error('Please enter phone number and message')
      return
    }
    sendMutation.mutate({ recipientPhone: phone, message })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="mr-2 h-4 w-4" />
          Send Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Send WhatsApp Message</DialogTitle>
          <DialogDescription>
            Send a custom WhatsApp message to a customer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +1 for US)
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/1600 characters
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sendMutation.isPending}>
            {sendMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
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
// Message Details Dialog
// =====================================================

function MessageDetailsDialog({ message }: { message: WhatsAppMessage }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Message Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Recipient</Label>
              <p className="font-medium">{message.recipient_phone}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">
                <StatusBadge status={message.status} />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Type</Label>
              <p className="font-medium capitalize">
                {message.message_type.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sent</Label>
              <p className="font-medium">
                {format(new Date(message.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            {message.order_number && (
              <div>
                <Label className="text-muted-foreground">Order</Label>
                <p className="font-medium">#{message.order_number}</p>
              </div>
            )}
            {message.provider_message_id && (
              <div>
                <Label className="text-muted-foreground">Provider ID</Label>
                <p className="font-mono text-xs">{message.provider_message_id}</p>
              </div>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Message Content</Label>
            <div className="mt-2 p-3 bg-muted rounded-lg whitespace-pre-wrap text-sm">
              {message.message_content}
            </div>
          </div>
          {message.error_message && (
            <div>
              <Label className="text-red-500">Error</Label>
              <p className="text-sm text-red-500">{message.error_message}</p>
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
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    pending: { variant: 'outline', icon: Clock },
    sent: { variant: 'secondary', icon: Send },
    delivered: { variant: 'default', icon: CheckCircle2 },
    read: { variant: 'default', icon: Eye },
    failed: { variant: 'destructive', icon: XCircle },
  }

  const config = variants[status] || variants.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

// =====================================================
// Messages Table
// =====================================================

function MessagesTable() {
  const [filters, setFilters] = useState<WhatsAppFilters>({
    page: 1,
    limit: 20,
  })
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 500)
  const queryClient = useQueryClient()

  // Update search filter when debounced value changes
  const activeFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch || undefined,
    }),
    [filters, debouncedSearch]
  )

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-messages', activeFilters],
    queryFn: () => whatsappService.getMessages(activeFilters),
  })

  const resendMutation = useMutation({
    mutationFn: (id: string) => whatsappService.resendMessage(id),
    onSuccess: () => {
      toast.success('Message resent successfully')
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-stats'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to resend message')
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
      messageType: value === 'all' ? undefined : value,
      page: 1,
    }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              View and manage WhatsApp messages sent to customers.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <SendMessageDialog />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone or content..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={filters.status || 'all'}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-37.5">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.messageType || 'all'}
            onValueChange={handleTypeFilter}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="order_confirmation">Order Confirmation</SelectItem>
              <SelectItem value="order_status">Order Status</SelectItem>
              <SelectItem value="shipping_update">Shipping Update</SelectItem>
              <SelectItem value="delivery_confirmation">Delivery</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No messages yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              WhatsApp messages will appear here when orders are placed.
            </p>
            <SendMessageDialog />
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="w-25">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message: WhatsAppMessage) => (
                    <TableRow key={message.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {message.recipient_phone}
                          </span>
                        </div>
                        {(message.customer_first_name || message.customer_last_name) && (
                          <p className="text-xs text-muted-foreground">
                            {message.customer_first_name} {message.customer_last_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {message.message_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={message.status} />
                      </TableCell>
                      <TableCell>
                        {message.order_number ? (
                          <span className="font-mono text-sm">
                            #{message.order_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(message.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MessageDetailsDialog message={message} />
                          {message.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendMutation.mutate(message.id)}
                              disabled={resendMutation.isPending}
                            >
                              <RotateCw className="h-4 w-4" />
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
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} messages
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
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
    queryKey: ['whatsapp-settings'],
    queryFn: () => whatsappService.getSettings(),
  })

  const settings = data?.data?.settings
  const isConfigured = data?.data?.isConfigured
  const provider = data?.data?.provider

  if (isLoading) {
    return <Skeleton className="h-100 w-full" />
  }

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${isConfigured ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {isConfigured ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {isConfigured ? 'WhatsApp is configured' : 'WhatsApp needs configuration'}
              </p>
              <p className="text-sm text-muted-foreground">
                Provider: {provider || 'Not set'}
              </p>
            </div>
          </div>

          {!isConfigured && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Setup Required</h4>
              <p className="text-sm text-yellow-700 mb-3">
                To enable WhatsApp notifications, add these environment variables to your server:
              </p>
              <pre className="bg-yellow-100 p-3 rounded text-xs overflow-x-auto">
{`# For Twilio WhatsApp
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
WHATSAPP_FROM_NUMBER=+1234567890

# OR for Meta Cloud API
WHATSAPP_PROVIDER=meta
META_WHATSAPP_TOKEN=your_token
META_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_FROM_NUMBER=+1234567890`}
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
            Control which notifications are sent via WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings && Object.entries(settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
                <Badge variant={value.value === 'true' ? 'default' : 'secondary'}>
                  {value.value === 'true' ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            ))}
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
    queryKey: ['whatsapp-templates'],
    queryFn: () => whatsappService.getTemplates(),
  })

  const templates = data?.data?.templates || []

  if (isLoading) {
    return <Skeleton className="h-100 w-full" />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Message Templates
            </CardTitle>
            <CardDescription>
              Pre-defined message templates for quick sending.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No templates found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{template.name}</h4>
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {template.template_key}
                  </code>
                </div>
                <div className="bg-muted p-3 rounded-lg whitespace-pre-wrap text-sm">
                  {template.message_content}
                </div>
                {template.variables && template.variables.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {template.variables.map((v: string) => (
                      <Badge key={v} variant="outline" className="text-xs">
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

export default function WhatsAppPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Notifications</h1>
          <p className="text-muted-foreground">
            Manage WhatsApp messages sent to customers for order updates.
          </p>
        </div>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Tabs */}
      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <MessagesTable />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

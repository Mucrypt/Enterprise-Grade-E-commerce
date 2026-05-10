'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import newsletterService, {
  NewsletterCampaign,
  NewsletterSubscriber,
  SubscriberFilters,
} from '@/services/newsletter.service'
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
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import {
  Search,
  Download,
  Upload,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Mail,
  Trash2,
  Edit,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function NewsletterPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<SubscriberFilters>({
    page: 1,
    limit: 20,
    status: '',
    source: '',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })
  const [searchInput, setSearchInput] = useState('')
  const [selectedSubscriber, setSelectedSubscriber] =
    useState<NewsletterSubscriber | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false)
  const [importEmails, setImportEmails] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignHtml, setCampaignHtml] = useState('')
  const [campaignText, setCampaignText] = useState('')
  const [campaignScheduleAt, setCampaignScheduleAt] = useState('')
  const [sendCampaignNow, setSendCampaignNow] = useState(true)
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    status: 'active' as 'active' | 'unsubscribed' | 'bounced',
  })

  // Fetch subscribers
  const {
    data: subscribersResponse,
    isLoading: isLoadingSubscribers,
    refetch: refetchSubscribers,
  } = useQuery({
    queryKey: ['newsletter-subscribers', filters],
    queryFn: () => newsletterService.getSubscribers(filters),
  })

  // Fetch stats
  const { data: statsResponse, isLoading: isLoadingStats } = useQuery({
    queryKey: ['newsletter-stats'],
    queryFn: () => newsletterService.getSubscriberStats(),
  })

  const {
    data: campaignsResponse,
    isLoading: isLoadingCampaigns,
    refetch: refetchCampaigns,
  } = useQuery({
    queryKey: ['newsletter-campaigns'],
    queryFn: () => newsletterService.getCampaigns(1, 5),
    staleTime: 30_000,
  })

  const subscribersData = subscribersResponse?.data
  const stats = statsResponse?.data?.stats
  const campaigns = campaignsResponse?.data?.campaigns || []

  // Update subscriber mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      newsletterService.updateSubscriber(id, data),
    onSuccess: () => {
      toast.success('Subscriber updated successfully')
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['newsletter-stats'] })
      setIsEditDialogOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update subscriber')
    },
  })

  // Delete subscriber mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => newsletterService.deleteSubscriber(id),
    onSuccess: () => {
      toast.success('Subscriber deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['newsletter-stats'] })
      setIsDeleteDialogOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete subscriber')
    },
  })

  // Import subscribers mutation
  const importMutation = useMutation({
    mutationFn: (subscribers: Array<{ email: string; name?: string }>) =>
      newsletterService.importSubscribers(subscribers),
    onSuccess: (response) => {
      const data = response.data
      toast.success(
        `Imported ${data?.imported || 0} subscribers. Skipped: ${
          data?.skipped || 0
        }`,
      )
      if (data?.errors && data.errors.length > 0) {
        toast.error(`Errors: ${data.errors.join(', ')}`)
      }
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['newsletter-stats'] })
      setIsImportDialogOpen(false)
      setImportEmails('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to import subscribers')
    },
  })

  const campaignMutation = useMutation({
    mutationFn: async (data: {
      name: string
      subject: string
      contentHtml: string
      contentText?: string
      scheduledAt?: string
      sendNow: boolean
    }) => {
      const created = await newsletterService.createCampaign({
        name: data.name,
        subject: data.subject,
        contentHtml: data.contentHtml,
        contentText: data.contentText || undefined,
        scheduledAt: data.scheduledAt || undefined,
      })

      const campaign = created.data?.campaign
      if (data.sendNow && campaign?.id) {
        await newsletterService.sendCampaign(campaign.id)
      }

      return created
    },
    onSuccess: async (_, variables) => {
      toast.success(
        variables.sendNow
          ? 'Campaign created and queued for sending'
          : 'Campaign draft saved',
      )
      queryClient.invalidateQueries({ queryKey: ['newsletter-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['newsletter-stats'] })
      setIsCampaignDialogOpen(false)
      setCampaignName('')
      setCampaignSubject('')
      setCampaignHtml('')
      setCampaignText('')
      setCampaignScheduleAt('')
      setSendCampaignNow(true)
      await refetchCampaigns()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create campaign')
    },
  })

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleFilterChange = (key: keyof SubscriberFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }))
  }

  const handleExport = async (status?: string) => {
    try {
      const blob = await newsletterService.exportSubscribers(status)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `newsletter-subscribers${
        status ? `-${status}` : ''
      }-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export downloaded successfully')
    } catch (error) {
      toast.error('Failed to export subscribers')
    }
  }

  const handleImport = () => {
    const lines = importEmails.split('\n').filter((line) => line.trim())
    const subscribers = lines.map((line) => {
      const [email, name] = line.split(',').map((s) => s.trim())
      return { email, name: name || undefined }
    })
    importMutation.mutate(subscribers)
  }

  const handleCampaignCreate = () => {
    if (!campaignName || !campaignSubject || !campaignHtml) {
      toast.error('Campaign name, subject, and HTML content are required')
      return
    }

    campaignMutation.mutate({
      name: campaignName,
      subject: campaignSubject,
      contentHtml: campaignHtml,
      contentText: campaignText || undefined,
      scheduledAt: campaignScheduleAt || undefined,
      sendNow: sendCampaignNow,
    })
  }

  const handleEdit = (subscriber: NewsletterSubscriber) => {
    setSelectedSubscriber(subscriber)
    setEditForm({
      email: subscriber.email,
      name: subscriber.name || '',
      status: subscriber.status,
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = (subscriber: NewsletterSubscriber) => {
    setSelectedSubscriber(subscriber)
    setIsDeleteDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className='bg-green-100 text-green-800'>Active</Badge>
      case 'unsubscribed':
        return <Badge className='bg-gray-100 text-gray-800'>Unsubscribed</Badge>
      case 'bounced':
        return <Badge className='bg-red-100 text-red-800'>Bounced</Badge>
      default:
        return <Badge variant='outline'>{status}</Badge>
    }
  }

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      website: 'bg-blue-100 text-blue-800',
      footer: 'bg-purple-100 text-purple-800',
      popup: 'bg-pink-100 text-pink-800',
      checkout: 'bg-orange-100 text-orange-800',
      import: 'bg-gray-100 text-gray-800',
      admin: 'bg-indigo-100 text-indigo-800',
    }
    return (
      <Badge className={colors[source] || 'bg-gray-100 text-gray-800'}>
        {source}
      </Badge>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Newsletter</h1>
          <p className='text-muted-foreground'>
            Manage your newsletter subscribers
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              refetchSubscribers()
              refetchCampaigns()
            }}
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            Refresh
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setIsCampaignDialogOpen(true)}
          >
            <Mail className='mr-2 h-4 w-4' />
            New Campaign
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm'>
                <Download className='mr-2 h-4 w-4' />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport()}>
                Export All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('active')}>
                Export Active Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size='sm' onClick={() => setIsImportDialogOpen(true)}>
            <Upload className='mr-2 h-4 w-4' />
            Import
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Subscribers
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className='h-8 w-24' />
            ) : (
              <div className='text-2xl font-bold'>
                {stats?.total?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active</CardTitle>
            <UserCheck className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className='h-8 w-24' />
            ) : (
              <div className='text-2xl font-bold text-green-600'>
                {stats?.active?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Unsubscribed</CardTitle>
            <UserX className='h-4 w-4 text-gray-500' />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className='h-8 w-24' />
            ) : (
              <div className='text-2xl font-bold text-gray-600'>
                {stats?.unsubscribed?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>This Month</CardTitle>
            <TrendingUp className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Skeleton className='h-8 w-24' />
            ) : (
              <div className='text-2xl font-bold text-blue-600'>
                +{stats?.thisMonth?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent campaigns */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <div>
            <CardTitle className='text-sm font-medium'>
              Recent Campaigns
            </CardTitle>
            <CardDescription>
              Drafts and promotions created from the dashboard
            </CardDescription>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setIsCampaignDialogOpen(true)}
          >
            <Mail className='mr-2 h-4 w-4' />
            Create
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingCampaigns ? (
            <div className='space-y-3'>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className='h-14 w-full' />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No campaigns yet. Create a promotion to start emailing
              subscribers.
            </p>
          ) : (
            <div className='space-y-3'>
              {campaigns.map((campaign: NewsletterCampaign) => (
                <div
                  key={campaign.id}
                  className='flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between'
                >
                  <div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='font-medium'>{campaign.name}</p>
                      <Badge variant='outline'>{campaign.status}</Badge>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {campaign.subject}
                    </p>
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {campaign.total_recipients.toLocaleString()} recipients
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source breakdown */}
      {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>
              Subscribers by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-4'>
              {Object.entries(stats.bySource).map(([source, count]) => (
                <div
                  key={source}
                  className='flex items-center gap-2 bg-muted px-3 py-2 rounded-lg'
                >
                  {getSourceBadge(source)}
                  <span className='font-medium'>{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-col sm:flex-row gap-4'>
            <div className='flex-1 flex gap-2'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search by email or name...'
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className='pl-10'
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value: string) =>
                handleFilterChange('status', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger className='w-37.5'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='unsubscribed'>Unsubscribed</SelectItem>
                <SelectItem value='bounced'>Bounced</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.source || 'all'}
              onValueChange={(value: string) =>
                handleFilterChange('source', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger className='w-37.5'>
                <SelectValue placeholder='Source' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Sources</SelectItem>
                <SelectItem value='website'>Website</SelectItem>
                <SelectItem value='footer'>Footer</SelectItem>
                <SelectItem value='popup'>Popup</SelectItem>
                <SelectItem value='checkout'>Checkout</SelectItem>
                <SelectItem value='import'>Import</SelectItem>
                <SelectItem value='admin'>Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Table */}
      <Card>
        <CardContent className='pt-6'>
          {isLoadingSubscribers ? (
            <div className='space-y-4'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : subscribersData?.subscribers?.length === 0 ? (
            <div className='text-center py-10'>
              <Mail className='mx-auto h-12 w-12 text-muted-foreground' />
              <h3 className='mt-4 text-lg font-semibold'>
                No subscribers found
              </h3>
              <p className='text-muted-foreground'>
                Subscribers will appear here when users sign up for your
                newsletter.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribersData?.subscribers?.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className='font-medium'>
                        {subscriber.email}
                      </TableCell>
                      <TableCell>{subscriber.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                      <TableCell>{getSourceBadge(subscriber.source)}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                          <Calendar className='h-3 w-3' />
                          {format(
                            new Date(subscriber.created_at),
                            'MMM d, yyyy',
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='sm'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => handleEdit(subscriber)}
                            >
                              <Edit className='mr-2 h-4 w-4' />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(subscriber)}
                              className='text-red-600'
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {subscribersData?.pagination && (
                <div className='flex items-center justify-between mt-4'>
                  <p className='text-sm text-muted-foreground'>
                    Showing{' '}
                    {(subscribersData.pagination.page - 1) *
                      subscribersData.pagination.limit +
                      1}{' '}
                    to{' '}
                    {Math.min(
                      subscribersData.pagination.page *
                        subscribersData.pagination.limit,
                      subscribersData.pagination.total,
                    )}{' '}
                    of {subscribersData.pagination.total} subscribers
                  </p>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={subscribersData.pagination.page <= 1}
                      onClick={() =>
                        handlePageChange(subscribersData.pagination.page - 1)
                      }
                    >
                      <ChevronLeft className='h-4 w-4' />
                      Previous
                    </Button>
                    <span className='text-sm'>
                      Page {subscribersData.pagination.page} of{' '}
                      {subscribersData.pagination.totalPages}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={
                        subscribersData.pagination.page >=
                        subscribersData.pagination.totalPages
                      }
                      onClick={() =>
                        handlePageChange(subscribersData.pagination.page + 1)
                      }
                    >
                      Next
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscriber</DialogTitle>
            <DialogDescription>Update subscriber information</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='status'>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value: string) =>
                  setEditForm({
                    ...editForm,
                    status: value as typeof editForm.status,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='unsubscribed'>Unsubscribed</SelectItem>
                  <SelectItem value='bounced'>Bounced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedSubscriber &&
                updateMutation.mutate({
                  id: selectedSubscriber.id,
                  data: editForm,
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscriber</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSubscriber?.email}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedSubscriber &&
                deleteMutation.mutate(selectedSubscriber.id)
              }
              className='bg-red-600 hover:bg-red-700'
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Import Subscribers</DialogTitle>
            <DialogDescription>
              Enter email addresses, one per line. Optionally add names with
              comma: email,name
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <textarea
              className='w-full h-48 p-3 border rounded-md font-mono text-sm'
              placeholder='example@email.com
john@example.com,John Doe
jane@example.com,Jane Smith'
              value={importEmails}
              onChange={(e) => setImportEmails(e.target.value)}
            />
            <p className='text-sm text-muted-foreground'>
              {importEmails.split('\n').filter((l) => l.trim()).length} email(s)
              to import
            </p>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsImportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || !importEmails.trim()}
            >
              {importMutation.isPending ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog
        open={isCampaignDialogOpen}
        onOpenChange={setIsCampaignDialogOpen}
      >
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Build a newsletter promotion or announcement and send it to active
              subscribers.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='campaignName'>Campaign Name</Label>
                <Input
                  id='campaignName'
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder='Black Friday Promotion'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='campaignSubject'>Email Subject</Label>
                <Input
                  id='campaignSubject'
                  value={campaignSubject}
                  onChange={(e) => setCampaignSubject(e.target.value)}
                  placeholder='Special offer for our customers'
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='campaignHtml'>Email HTML Content</Label>
              <Textarea
                id='campaignHtml'
                className='min-h-40 font-mono text-sm'
                value={campaignHtml}
                onChange={(e) => setCampaignHtml(e.target.value)}
                placeholder='<h1>Promotion</h1><p>Write your HTML email here.</p>'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='campaignText'>Plain Text Version</Label>
              <Textarea
                id='campaignText'
                className='min-h-28 font-mono text-sm'
                value={campaignText}
                onChange={(e) => setCampaignText(e.target.value)}
                placeholder='Plain text fallback for email clients'
              />
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='campaignScheduleAt'>
                  Schedule At (optional)
                </Label>
                <Input
                  id='campaignScheduleAt'
                  type='datetime-local'
                  value={campaignScheduleAt}
                  onChange={(e) => setCampaignScheduleAt(e.target.value)}
                />
              </div>
              <div className='flex items-end gap-2 rounded-lg border bg-muted/40 p-3'>
                <input
                  id='sendCampaignNow'
                  type='checkbox'
                  checked={sendCampaignNow}
                  onChange={(e) => setSendCampaignNow(e.target.checked)}
                  className='h-4 w-4'
                />
                <Label
                  htmlFor='sendCampaignNow'
                  className='cursor-pointer text-sm'
                >
                  Create and send immediately
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCampaignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCampaignCreate}
              disabled={campaignMutation.isPending}
            >
              {campaignMutation.isPending ? 'Saving...' : 'Save Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

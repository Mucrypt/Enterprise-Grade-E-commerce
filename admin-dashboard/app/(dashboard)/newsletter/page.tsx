'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import newsletterService, {
  CampaignConversionsResponse,
  DeliverabilityDashboard,
  NewsletterCampaign,
  NewsletterSubscriber,
  SubscriberFilters,
} from '@/services/newsletter.service'
import { productService } from '@/services/product.service'
import VisualEmailEditor from '@/components/newsletter/VisualEmailEditor'
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
  ShieldCheck,
  Gauge,
  FlaskConical,
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

interface ProductOption {
  id: string
  name: string
  slug: string
  price: number
  imageUrl?: string
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildProductCampaignHtml(options: {
  headline: string
  products: ProductOption[]
}): string {
  const safeHeadline = escapeHtml(options.headline)
  const items = options.products
    .map((product) => {
      const url = `https://techtoolstore.com/products/${product.slug}`
      const imageCell = product.imageUrl
        ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(
            product.name,
          )}" width="84" height="84" style="display:block;border-radius:12px;object-fit:cover;border:1px solid #e5e7eb;"/>`
        : `<div style="width:84px;height:84px;border-radius:12px;border:1px solid #e5e7eb;background:#f8fafc;"></div>`

      return `
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:96px;">${imageCell}</td>
        <td style="padding:10px 0;vertical-align:top;">
          <a href="${url}" style="color:#0f172a;text-decoration:none;font-size:16px;font-weight:700;line-height:1.35;display:inline-block;">${escapeHtml(
        product.name,
      )}</a>
          <div style="margin-top:6px;font-size:16px;font-weight:700;color:#f97316;">$${product.price.toFixed(
            2,
          )}</div>
          <a href="${url}" style="display:inline-block;margin-top:8px;color:#1d4ed8;text-decoration:none;font-size:13px;font-weight:600;">View product</a>
        </td>
      </tr>`
    })
    .join('')

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeHeadline}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;background:linear-gradient(125deg,#f97316,#ea580c);color:#ffffff;text-align:center;">
                <div style="font-size:34px;font-weight:800;line-height:1;">TechTools</div>
                <div style="margin-top:8px;font-size:14px;opacity:0.95;">${safeHeadline}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px;">
                <p style="margin:0 0 14px 0;color:#334155;font-size:15px;line-height:1.6;">We picked these products for customers who want the latest and best value tech.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${items}
                </table>
                <div style="margin-top:18px;">
                  <a href="https://techtoolstore.com/products" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">Shop all new arrivals</a>
                </div>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 12px;" />
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">You received this because you are subscribed to TechTools emails.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

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
  const [showVisualEditor, setShowVisualEditor] = useState(false)
  const [abTestEnabled, setAbTestEnabled] = useState(false)
  const [campaignSubjectB, setCampaignSubjectB] = useState('')
  const [campaignHtmlB, setCampaignHtmlB] = useState('')
  const [campaignTextB, setCampaignTextB] = useState('')
  const [segmentASources, setSegmentASources] = useState<string[]>([])
  const [segmentAStatuses, setSegmentAStatuses] = useState<string[]>([])
  const [segmentBSources, setSegmentBSources] = useState<string[]>([])
  const [segmentBStatuses, setSegmentBStatuses] = useState<string[]>([])
  const [productCampaignTitle, setProductCampaignTitle] = useState(
    'New Product Spotlight',
  )
  const [productCampaignScheduleAt, setProductCampaignScheduleAt] = useState('')
  const [productCampaignSearch, setProductCampaignSearch] = useState('')
  const [productCampaignSendNow, setProductCampaignSendNow] = useState(false)
  const [selectedProductCampaignIds, setSelectedProductCampaignIds] = useState<
    string[]
  >([])
  const [analyticsCampaignId, setAnalyticsCampaignId] = useState<string>('')
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

  const { data: deliverabilityResponse, isLoading: isLoadingDeliverability } =
    useQuery({
      queryKey: ['newsletter-deliverability'],
      queryFn: () => newsletterService.getDeliverabilityDashboard(),
      staleTime: 45_000,
    })

  const { data: conversionAnalyticsResponse } = useQuery({
    queryKey: ['newsletter-campaign-conversions', analyticsCampaignId],
    queryFn: () =>
      newsletterService.getCampaignConversions(analyticsCampaignId),
    enabled: Boolean(analyticsCampaignId),
    staleTime: 30_000,
  })

  const { data: productOptions = [], isLoading: isLoadingProductOptions } =
    useQuery({
      queryKey: ['newsletter-product-campaign-options'],
      queryFn: async () => {
        const response = await productService.getProducts({
          limit: 80,
          sortBy: 'updated_at',
          sortOrder: 'desc',
        })
        const payload = response?.data as any
        const products = payload?.products || payload?.items || []
        return products.map((product: any) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: Number(
            product.sale_price || product.base_price || product.basePrice || 0,
          ),
          imageUrl:
            product.primary_image || product.image || product.thumbnail || '',
        })) as ProductOption[]
      },
      staleTime: 60_000,
    })

  const subscribersData = subscribersResponse?.data
  const stats = statsResponse?.data?.stats
  const campaigns = campaignsResponse?.data?.campaigns || []
  const deliverability = deliverabilityResponse?.data?.dashboard as
    | DeliverabilityDashboard
    | undefined
  const conversionAnalytics = conversionAnalyticsResponse?.data as
    | CampaignConversionsResponse
    | undefined

  const activeAnalyticsCampaignId =
    analyticsCampaignId || campaigns[0]?.id || ''

  useEffect(() => {
    if (!analyticsCampaignId && campaigns[0]?.id) {
      setAnalyticsCampaignId(campaigns[0].id)
    }
  }, [analyticsCampaignId, campaigns])

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
        abTestEnabled,
        subjectA: data.subject,
        subjectB: campaignSubjectB || undefined,
        contentHtmlA: data.contentHtml,
        contentHtmlB: campaignHtmlB || undefined,
        contentTextA: data.contentText || undefined,
        contentTextB: campaignTextB || undefined,
        segmentA: {
          sources: segmentASources,
          statuses: segmentAStatuses,
        },
        segmentB: {
          sources: segmentBSources,
          statuses: segmentBStatuses,
        },
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
      setShowVisualEditor(false)
      setAbTestEnabled(false)
      setCampaignSubjectB('')
      setCampaignHtmlB('')
      setCampaignTextB('')
      setSegmentASources([])
      setSegmentAStatuses([])
      setSegmentBSources([])
      setSegmentBStatuses([])
      await refetchCampaigns()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create campaign')
    },
  })

  const productCampaignMutation = useMutation({
    mutationFn: async () => {
      const selectedProducts = productOptions.filter((product) =>
        selectedProductCampaignIds.includes(product.id),
      )

      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product')
      }

      const subject =
        selectedProducts.length === 1
          ? `New in store: ${selectedProducts[0].name}`
          : `New products just landed: ${selectedProducts
              .slice(0, 2)
              .map((product) => product.name)
              .join(' + ')}`

      const html = buildProductCampaignHtml({
        headline: productCampaignTitle.trim() || 'New Product Spotlight',
        products: selectedProducts,
      })

      const text = [
        productCampaignTitle.trim() || 'New Product Spotlight',
        '',
        ...selectedProducts.map(
          (product) =>
            `${product.name} - $${product.price.toFixed(
              2,
            )} - https://techtoolstore.com/products/${product.slug}`,
        ),
        '',
        'See all new arrivals: https://techtoolstore.com/products',
      ].join('\n')

      const created = await newsletterService.createCampaign({
        name: `${productCampaignTitle.trim() || 'Product Campaign'} - ${format(
          new Date(),
          'yyyy-MM-dd',
        )}`,
        subject,
        contentHtml: html,
        contentText: text,
        scheduledAt: productCampaignScheduleAt || undefined,
      })

      const campaign = created.data?.campaign
      if (productCampaignSendNow && campaign?.id) {
        await newsletterService.sendCampaign(campaign.id)
      }

      return created
    },
    onSuccess: async () => {
      toast.success(
        productCampaignSendNow
          ? 'Product campaign queued for sending'
          : 'Product campaign saved as draft',
      )
      queryClient.invalidateQueries({ queryKey: ['newsletter-campaigns'] })
      setSelectedProductCampaignIds([])
      setProductCampaignScheduleAt('')
      setProductCampaignSearch('')
      await refetchCampaigns()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create product campaign')
    },
  })

  const filteredProductOptions = productOptions.filter((product) =>
    product.name.toLowerCase().includes(productCampaignSearch.toLowerCase()),
  )

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

      {/* Deliverability dashboard */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Domain Health</CardTitle>
            <Gauge className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoadingDeliverability ? (
              <Skeleton className='h-8 w-24' />
            ) : (
              <>
                <div className='text-2xl font-bold'>
                  {deliverability?.domainHealth?.score ?? 0}
                </div>
                <p className='text-xs text-muted-foreground capitalize'>
                  {deliverability?.domainHealth?.label || 'unknown'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Bounce Rate (30d)
            </CardTitle>
            <AlertTriangle className='h-4 w-4 text-orange-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(deliverability?.totals?.bounceRate ?? 0).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Complaint Rate (30d)
            </CardTitle>
            <ShieldCheck className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(deliverability?.totals?.complaintRate ?? 0).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              A/B Recipient Pool
            </CardTitle>
            <FlaskConical className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {(deliverability?.abPerformance || []).reduce(
                (sum, item) => sum + Number(item.recipients || 0),
                0,
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {deliverability && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>
              Domain Health Checks
            </CardTitle>
            <CardDescription>
              From domain:{' '}
              {deliverability.domainHealth.fromDomain || 'Not detected'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap gap-3'>
              <Badge
                variant={
                  deliverability.domainHealth.checks.spf
                    ? 'default'
                    : 'destructive'
                }
              >
                SPF {deliverability.domainHealth.checks.spf ? 'OK' : 'Missing'}
              </Badge>
              <Badge
                variant={
                  deliverability.domainHealth.checks.dkim
                    ? 'default'
                    : 'destructive'
                }
              >
                DKIM{' '}
                {deliverability.domainHealth.checks.dkim ? 'OK' : 'Missing'}
              </Badge>
              <Badge
                variant={
                  deliverability.domainHealth.checks.dmarc
                    ? 'default'
                    : 'destructive'
                }
              >
                DMARC{' '}
                {deliverability.domainHealth.checks.dmarc ? 'OK' : 'Missing'}
              </Badge>
            </div>
            <div className='space-y-2'>
              {deliverability.domains.map((domain) => (
                <div
                  key={domain.domain}
                  className='flex items-center justify-between rounded border p-2 text-sm'
                >
                  <span>{domain.domain || 'unknown'}</span>
                  <span className='text-muted-foreground'>
                    sent {domain.sent} / bounce {domain.bounced} / failed{' '}
                    {domain.failed}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Product Email Campaign Builder
          </CardTitle>
          <CardDescription>
            Pick products and create a polished campaign draft in one step.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='product-campaign-title'>Campaign Headline</Label>
              <Input
                id='product-campaign-title'
                value={productCampaignTitle}
                onChange={(event) =>
                  setProductCampaignTitle(event.target.value)
                }
                placeholder='New Product Spotlight'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='product-campaign-schedule'>
                Schedule At (optional)
              </Label>
              <Input
                id='product-campaign-schedule'
                type='datetime-local'
                value={productCampaignScheduleAt}
                onChange={(event) =>
                  setProductCampaignScheduleAt(event.target.value)
                }
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='product-campaign-search'>Select Products</Label>
            <Input
              id='product-campaign-search'
              placeholder='Search products by name...'
              value={productCampaignSearch}
              onChange={(event) => setProductCampaignSearch(event.target.value)}
            />
            <div className='max-h-60 overflow-y-auto rounded-lg border p-2 space-y-1'>
              {isLoadingProductOptions ? (
                <div className='space-y-2'>
                  <Skeleton className='h-8 w-full' />
                  <Skeleton className='h-8 w-full' />
                </div>
              ) : filteredProductOptions.length === 0 ? (
                <p className='text-sm text-muted-foreground p-2'>
                  No products match your search.
                </p>
              ) : (
                filteredProductOptions.map((product) => (
                  <label
                    key={product.id}
                    className='flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted'
                  >
                    <div className='flex min-w-0 items-center gap-3'>
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className='h-10 w-10 shrink-0 rounded-md border object-cover'
                          loading='lazy'
                        />
                      ) : (
                        <div className='h-10 w-10 shrink-0 rounded-md border bg-muted' />
                      )}
                      <div className='min-w-0'>
                        <p className='text-sm font-medium truncate'>
                          {product.name}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          ${product.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <input
                      type='checkbox'
                      checked={selectedProductCampaignIds.includes(product.id)}
                      onChange={(event) => {
                        setSelectedProductCampaignIds((prev) =>
                          event.target.checked
                            ? [...prev, product.id]
                            : prev.filter((id) => id !== product.id),
                        )
                      }}
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={productCampaignSendNow}
                onChange={(event) =>
                  setProductCampaignSendNow(event.target.checked)
                }
              />
              Send immediately after creating campaign
            </label>
            <Button
              onClick={() => productCampaignMutation.mutate()}
              disabled={
                productCampaignMutation.isPending ||
                selectedProductCampaignIds.length === 0
              }
            >
              {productCampaignMutation.isPending
                ? 'Creating...'
                : 'Create Product Campaign'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                      {campaign.ab_winner_variant && (
                        <Badge className='bg-blue-100 text-blue-800'>
                          Winner {campaign.ab_winner_variant}
                        </Badge>
                      )}
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {campaign.subject}
                    </p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <div className='text-sm text-muted-foreground'>
                      {campaign.total_recipients.toLocaleString()} recipients
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setAnalyticsCampaignId(campaign.id)}
                    >
                      Analytics
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Conversion Attribution
          </CardTitle>
          <CardDescription>
            Click-to-order tracking for campaign{' '}
            {activeAnalyticsCampaignId || 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!conversionAnalytics ? (
            <p className='text-sm text-muted-foreground'>
              Select a campaign from “Recent Campaigns” to view attributed
              orders and revenue.
            </p>
          ) : (
            <div className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-3'>
                <div className='rounded border p-3'>
                  <p className='text-xs text-muted-foreground'>
                    Attributed Orders
                  </p>
                  <p className='text-2xl font-semibold'>
                    {conversionAnalytics.summary.orders}
                  </p>
                </div>
                <div className='rounded border p-3'>
                  <p className='text-xs text-muted-foreground'>
                    Attributed Revenue
                  </p>
                  <p className='text-2xl font-semibold'>
                    ${conversionAnalytics.summary.revenue.toFixed(2)}
                  </p>
                </div>
                <div className='rounded border p-3'>
                  <p className='text-xs text-muted-foreground'>
                    Attribution Events
                  </p>
                  <p className='text-2xl font-semibold'>
                    {conversionAnalytics.summary.attributedEvents}
                  </p>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <p className='text-xs font-semibold uppercase text-muted-foreground'>
                    By Variant
                  </p>
                  {conversionAnalytics.byVariant.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No variant data yet.
                    </p>
                  ) : (
                    conversionAnalytics.byVariant.map((item) => (
                      <div
                        key={item.variant}
                        className='flex items-center justify-between rounded border p-2 text-sm'
                      >
                        <span>Variant {item.variant}</span>
                        <span>
                          {item.orders} orders · ${item.revenue.toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className='space-y-2'>
                  <p className='text-xs font-semibold uppercase text-muted-foreground'>
                    Top Product Conversions
                  </p>
                  {conversionAnalytics.byProduct.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No product-level conversions yet.
                    </p>
                  ) : (
                    conversionAnalytics.byProduct.slice(0, 6).map((item) => (
                      <div
                        key={item.productSlug}
                        className='flex items-center justify-between rounded border p-2 text-sm'
                      >
                        <span className='truncate'>{item.productSlug}</span>
                        <span>
                          {item.orders} · ${item.revenue.toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
              <div className='mb-2 flex justify-end'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setShowVisualEditor((prev) => !prev)}
                >
                  {showVisualEditor
                    ? 'Hide Visual Builder'
                    : 'Open Visual Builder'}
                </Button>
              </div>

              {showVisualEditor && (
                <div className='mb-3'>
                  <VisualEmailEditor
                    defaultSubject={campaignSubject}
                    onApply={(payload) => {
                      setCampaignSubject(payload.subject)
                      setCampaignHtml(payload.html)
                      setCampaignText(payload.text)
                      toast.success('Visual template applied to campaign')
                    }}
                  />
                </div>
              )}

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

            <div className='rounded-lg border bg-muted/30 p-3 space-y-3'>
              <div className='flex items-center gap-2'>
                <input
                  id='abTestEnabled'
                  type='checkbox'
                  checked={abTestEnabled}
                  onChange={(e) => setAbTestEnabled(e.target.checked)}
                  className='h-4 w-4'
                />
                <Label htmlFor='abTestEnabled' className='cursor-pointer'>
                  Enable A/B subject/content variants per segment
                </Label>
              </div>

              {abTestEnabled && (
                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='campaignSubjectB'>Variant B Subject</Label>
                    <Input
                      id='campaignSubjectB'
                      value={campaignSubjectB}
                      onChange={(e) => setCampaignSubjectB(e.target.value)}
                      placeholder='Alternative subject line for B'
                    />
                    <Label htmlFor='campaignHtmlB'>Variant B HTML</Label>
                    <Textarea
                      id='campaignHtmlB'
                      className='min-h-24 font-mono text-sm'
                      value={campaignHtmlB}
                      onChange={(e) => setCampaignHtmlB(e.target.value)}
                      placeholder='<h1>Variant B</h1><p>Alternative HTML.</p>'
                    />
                    <Label htmlFor='campaignTextB'>Variant B Text</Label>
                    <Textarea
                      id='campaignTextB'
                      className='min-h-20 font-mono text-sm'
                      value={campaignTextB}
                      onChange={(e) => setCampaignTextB(e.target.value)}
                      placeholder='Alternative plain text'
                    />
                  </div>

                  <div className='space-y-3'>
                    <div>
                      <Label className='text-sm'>Segment A Sources</Label>
                      <div className='mt-2 flex flex-wrap gap-3 text-sm'>
                        {[
                          'website',
                          'checkout',
                          'popup',
                          'footer',
                          'import',
                          'admin',
                        ].map((source) => (
                          <label
                            key={`a-${source}`}
                            className='flex items-center gap-1'
                          >
                            <input
                              type='checkbox'
                              checked={segmentASources.includes(source)}
                              onChange={(e) =>
                                setSegmentASources((prev) =>
                                  e.target.checked
                                    ? [...prev, source]
                                    : prev.filter((s) => s !== source),
                                )
                              }
                            />
                            <span className='capitalize'>{source}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className='text-sm'>Segment B Sources</Label>
                      <div className='mt-2 flex flex-wrap gap-3 text-sm'>
                        {[
                          'website',
                          'checkout',
                          'popup',
                          'footer',
                          'import',
                          'admin',
                        ].map((source) => (
                          <label
                            key={`b-${source}`}
                            className='flex items-center gap-1'
                          >
                            <input
                              type='checkbox'
                              checked={segmentBSources.includes(source)}
                              onChange={(e) =>
                                setSegmentBSources((prev) =>
                                  e.target.checked
                                    ? [...prev, source]
                                    : prev.filter((s) => s !== source),
                                )
                              }
                            />
                            <span className='capitalize'>{source}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className='text-sm'>Segment A Statuses</Label>
                      <div className='mt-2 flex flex-wrap gap-3 text-sm'>
                        {['active', 'unsubscribed', 'bounced'].map((status) => (
                          <label
                            key={`as-${status}`}
                            className='flex items-center gap-1'
                          >
                            <input
                              type='checkbox'
                              checked={segmentAStatuses.includes(status)}
                              onChange={(e) =>
                                setSegmentAStatuses((prev) =>
                                  e.target.checked
                                    ? [...prev, status]
                                    : prev.filter((s) => s !== status),
                                )
                              }
                            />
                            <span className='capitalize'>{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className='text-sm'>Segment B Statuses</Label>
                      <div className='mt-2 flex flex-wrap gap-3 text-sm'>
                        {['active', 'unsubscribed', 'bounced'].map((status) => (
                          <label
                            key={`bs-${status}`}
                            className='flex items-center gap-1'
                          >
                            <input
                              type='checkbox'
                              checked={segmentBStatuses.includes(status)}
                              onChange={(e) =>
                                setSegmentBStatuses((prev) =>
                                  e.target.checked
                                    ? [...prev, status]
                                    : prev.filter((s) => s !== status),
                                )
                              }
                            />
                            <span className='capitalize'>{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

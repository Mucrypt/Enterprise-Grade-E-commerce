'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  Layers,
  Store,
  ShoppingCart,
  BarChart3,
  Star,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Percent,
  Megaphone,
} from 'lucide-react'
import {
  trendingService,
  TrendingCollection,
  TrendingBrand,
} from '@/services/trending.service'
import { toast } from 'sonner'
import Image from 'next/image'

// ============================================
// Stats Card Component
// ============================================
function StatsCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  description,
}: {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  description?: string
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {title}
        </CardTitle>
        <Icon className='h-4 w-4 text-orange-500' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {change && (
          <div className='flex items-center gap-1 text-xs mt-1'>
            {changeType === 'positive' && (
              <ArrowUp className='h-3 w-3 text-green-500' />
            )}
            {changeType === 'negative' && (
              <ArrowDown className='h-3 w-3 text-red-500' />
            )}
            <span
              className={
                changeType === 'positive'
                  ? 'text-green-500'
                  : changeType === 'negative'
                  ? 'text-red-500'
                  : 'text-muted-foreground'
              }
            >
              {change}
            </span>
            {description && (
              <span className='text-muted-foreground'>{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Collections Table Component
// ============================================
function CollectionsTable({
  collections,
  isLoading,
  onToggleFeatured,
  onUpdateRank,
  onPromote,
  promotingId,
}: {
  collections: TrendingCollection[]
  isLoading: boolean
  onToggleFeatured: (id: string, featured: boolean) => void
  onUpdateRank: (id: string, rank: number) => void
  onPromote: (collection: TrendingCollection) => void
  promotingId: string | null
}) {
  if (isLoading) {
    return (
      <div className='space-y-3'>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className='h-16 w-full' />
        ))}
      </div>
    )
  }

  if (!collections.length) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <Layers className='h-12 w-12 mx-auto mb-4 opacity-50' />
        <p>No collections found</p>
        <p className='text-sm'>
          Create collections to feature them on trending
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Collection</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className='text-right'>Items</TableHead>
          <TableHead className='w-28'>Rank</TableHead>
          <TableHead>Featured</TableHead>
          <TableHead className='text-right'>Advertise</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {collections.map((collection) => (
          <TableRow key={collection.id}>
            <TableCell>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 rounded-lg bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center'>
                  <Layers className='h-5 w-5 text-white' />
                </div>
                <p className='font-medium'>{collection.name}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={collection.isActive ? 'default' : 'secondary'}
                className={collection.isActive ? 'bg-green-500' : ''}
              >
                {collection.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className='text-right font-medium'>
              {collection.itemsCount || 0}
            </TableCell>
            <TableCell>
              <Input
                type='number'
                defaultValue={collection.trending_rank ?? ''}
                placeholder='Unranked'
                className='h-8 w-20'
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (e.target.value !== '' && !Number.isNaN(value)) {
                    onUpdateRank(collection.id, value)
                  }
                }}
              />
            </TableCell>
            <TableCell>
              <Switch
                checked={collection.is_featured}
                onCheckedChange={(checked: boolean) =>
                  onToggleFeatured(collection.id, checked)
                }
              />
            </TableCell>
            <TableCell className='text-right'>
              <Button
                variant='outline'
                size='sm'
                className='gap-1.5'
                disabled={promotingId === collection.id}
                onClick={() => onPromote(collection)}
              >
                <Megaphone className='h-3.5 w-3.5' />
                {promotingId === collection.id ? 'Creating...' : 'Promote'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ============================================
// Brands Table Component
// ============================================
function BrandsTable({
  brands,
  isLoading,
  onToggleFeatured,
  onUpdateRank,
  onPromote,
  promotingId,
}: {
  brands: TrendingBrand[]
  isLoading: boolean
  onToggleFeatured: (id: string, featured: boolean) => void
  onUpdateRank: (id: string, rank: number) => void
  onPromote: (brand: TrendingBrand) => void
  promotingId: string | null
}) {
  if (isLoading) {
    return (
      <div className='space-y-3'>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className='h-16 w-full' />
        ))}
      </div>
    )
  }

  if (!brands.length) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <Store className='h-12 w-12 mx-auto mb-4 opacity-50' />
        <p>No brands found</p>
        <p className='text-sm'>Create brands to feature them on trending</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Brand</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className='text-right'>Products</TableHead>
          <TableHead className='text-right'>Units Sold</TableHead>
          <TableHead className='text-right'>Revenue</TableHead>
          <TableHead className='w-28'>Rank</TableHead>
          <TableHead>Featured</TableHead>
          <TableHead className='text-right'>Advertise</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brands.map((brand) => (
          <TableRow key={brand.id}>
            <TableCell>
              <div className='flex items-center gap-3'>
                {brand.logo_url ? (
                  <Image
                    src={brand.logo_url}
                    alt={brand.name}
                    width={40}
                    height={40}
                    className='rounded-lg object-cover'
                  />
                ) : (
                  <div className='w-10 h-10 rounded-lg bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center'>
                    <Store className='h-5 w-5 text-white' />
                  </div>
                )}
                <p className='font-medium'>{brand.name}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={brand.is_active ? 'default' : 'secondary'}
                className={brand.is_active ? 'bg-green-500' : ''}
              >
                {brand.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className='text-right font-medium'>
              {brand.product_count || 0}
            </TableCell>
            <TableCell className='text-right'>
              {(brand.units_sold || 0).toLocaleString()}
            </TableCell>
            <TableCell className='text-right'>
              ${(brand.total_sales || 0).toLocaleString()}
            </TableCell>
            <TableCell>
              <Input
                type='number'
                defaultValue={brand.trending_rank ?? ''}
                placeholder='Unranked'
                className='h-8 w-20'
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (e.target.value !== '' && !Number.isNaN(value)) {
                    onUpdateRank(brand.id, value)
                  }
                }}
              />
            </TableCell>
            <TableCell>
              <Switch
                checked={brand.is_featured || false}
                onCheckedChange={(checked: boolean) =>
                  onToggleFeatured(brand.id, checked)
                }
              />
            </TableCell>
            <TableCell className='text-right'>
              <Button
                variant='outline'
                size='sm'
                className='gap-1.5'
                disabled={promotingId === brand.id}
                onClick={() => onPromote(brand)}
              >
                <Megaphone className='h-3.5 w-3.5' />
                {promotingId === brand.id ? 'Creating...' : 'Promote'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ============================================
// Analytics Chart Component (Simple)
// ============================================
function AnalyticsChart({
  data,
}: {
  data: { date: string; orders: number; revenue: number }[]
}) {
  // Each series scales against its own max, not a shared one -- orders and
  // revenue live on very different numeric scales, and sharing a divisor
  // (as the previous "views/clicks/sales" version did) produced NaN/
  // Infinity bar heights whenever the shared series was all zero.
  const maxOrders = Math.max(1, ...data.map((d) => d.orders))
  const maxRevenue = Math.max(1, ...data.map((d) => d.revenue))

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-4 text-sm'>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 rounded-full bg-blue-500' />
          <span>Orders</span>
        </div>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 rounded-full bg-green-500' />
          <span>Revenue</span>
        </div>
      </div>
      <div className='flex items-end gap-1 h-48'>
        {data.map((item, index) => (
          <div key={index} className='flex-1 flex flex-col items-center gap-1'>
            <div className='w-full flex gap-0.5 items-end h-40'>
              <div
                className='flex-1 bg-blue-500 rounded-t-sm transition-all'
                style={{ height: `${(item.orders / maxOrders) * 100}%` }}
                title={`Orders: ${item.orders}`}
              />
              <div
                className='flex-1 bg-green-500 rounded-t-sm transition-all'
                style={{ height: `${(item.revenue / maxRevenue) * 100}%` }}
                title={`Revenue: $${item.revenue.toLocaleString()}`}
              />
            </div>
            <span className='text-xs text-muted-foreground'>
              {new Date(item.date).toLocaleDateString('en', {
                weekday: 'short',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Main Trending Page
// ============================================
export default function TrendingPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [analyticsPeriod, setAnalyticsPeriod] = useState<
    'day' | 'week' | 'month'
  >('week')
  const [promotingId, setPromotingId] = useState<string | null>(null)

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['trending-stats'],
    queryFn: () => trendingService.getStats(),
  })

  const { data: collections, isLoading: collectionsLoading } = useQuery({
    queryKey: ['trending-collections'],
    queryFn: () => trendingService.getFeaturedCollections(),
  })

  const { data: brands, isLoading: brandsLoading } = useQuery({
    queryKey: ['trending-brands'],
    queryFn: () => trendingService.getFeaturedBrands(),
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['trending-analytics', analyticsPeriod],
    queryFn: () => trendingService.getAnalytics(analyticsPeriod),
  })

  // Mutations
  const toggleCollectionFeatured = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      trendingService.toggleCollectionFeatured(id, featured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-collections'] })
      queryClient.invalidateQueries({ queryKey: ['trending-stats'] })
      toast.success('Collection updated')
    },
    onError: () => {
      toast.error('Failed to update collection')
    },
  })

  const toggleBrandFeatured = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      trendingService.toggleBrandFeatured(id, featured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-brands'] })
      queryClient.invalidateQueries({ queryKey: ['trending-stats'] })
      toast.success('Brand updated')
    },
    onError: () => {
      toast.error('Failed to update brand')
    },
  })

  const updateCollectionRank = useMutation({
    mutationFn: ({ id, rank }: { id: string; rank: number }) =>
      trendingService.updateCollectionRank(id, rank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-collections'] })
      toast.success('Collection rank updated')
    },
    onError: () => toast.error('Failed to update rank'),
  })

  const updateBrandRank = useMutation({
    mutationFn: ({ id, rank }: { id: string; rank: number }) =>
      trendingService.updateBrandRank(id, rank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending-brands'] })
      toast.success('Brand rank updated')
    },
    onError: () => toast.error('Failed to update rank'),
  })

  const handlePromoteCollection = async (collection: TrendingCollection) => {
    setPromotingId(collection.id)
    try {
      const campaignId = await trendingService.promoteCollection(collection)
      toast.success(`Draft campaign created from "${collection.name}" -- pick channels and schedule next.`)
      router.push(`/dashboard/promotions/${campaignId}/edit`)
    } catch {
      toast.error('Failed to create a promotion campaign for this collection.')
    } finally {
      setPromotingId(null)
    }
  }

  const handlePromoteBrand = async (brand: TrendingBrand) => {
    setPromotingId(brand.id)
    try {
      const campaignId = await trendingService.promoteBrand(brand)
      toast.success(`Draft campaign created from "${brand.name}" -- pick channels and schedule next.`)
      router.push(`/dashboard/promotions/${campaignId}/edit`)
    } catch {
      toast.error('Failed to create a promotion campaign for this brand.')
    } finally {
      setPromotingId(null)
    }
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['trending-stats'] })
    queryClient.invalidateQueries({ queryKey: ['trending-collections'] })
    queryClient.invalidateQueries({ queryKey: ['trending-brands'] })
    queryClient.invalidateQueries({ queryKey: ['trending-analytics'] })
    toast.success('Data refreshed')
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight flex items-center gap-3'>
            <TrendingUp className='h-8 w-8 text-orange-500' />
            Trending Management
          </h1>
          <p className='text-muted-foreground mt-1'>
            Manage featured collections and brands for the trending page
          </p>
        </div>
        <Button variant='outline' onClick={handleRefresh} className='gap-2'>
          <RefreshCw className='h-4 w-4' />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <StatsCard
          title='Total Collections'
          value={stats?.totalCollections || 0}
          change={`${stats?.featuredCollections || 0} featured`}
          changeType='neutral'
          icon={Layers}
        />
        <StatsCard
          title='Total Brands'
          value={stats?.totalBrands || 0}
          change={`${stats?.featuredBrands || 0} featured`}
          changeType='neutral'
          icon={Store}
        />
        <StatsCard
          title='Orders (7d)'
          value={(stats?.totalOrders || 0).toLocaleString()}
          description='real order count, last 7 days'
          icon={ShoppingCart}
        />
        <StatsCard
          title='Conversion Rate'
          value={`${Number(stats?.conversionRate || 0).toFixed(1)}%`}
          description='visitors who completed payment'
          icon={Percent}
        />
      </div>

      {/* Analytics Card */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <BarChart3 className='h-5 w-5 text-orange-500' />
              Trending Analytics
            </CardTitle>
            <CardDescription>
              Performance metrics for trending content
            </CardDescription>
          </div>
          <Select
            value={analyticsPeriod}
            onValueChange={(v: string) =>
              setAnalyticsPeriod(v as 'day' | 'week' | 'month')
            }
          >
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='day'>Today</SelectItem>
              <SelectItem value='week'>This Week</SelectItem>
              <SelectItem value='month'>This Month</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <Skeleton className='h-48 w-full' />
          ) : (
            <>
              <div className='grid grid-cols-2 gap-4 mb-6'>
                <div className='text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg'>
                  <p className='text-2xl font-bold text-blue-600'>
                    {(analytics?.summary.totalOrders || 0).toLocaleString()}
                  </p>
                  <p className='text-sm text-muted-foreground'>Orders</p>
                </div>
                <div className='text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg'>
                  <p className='text-2xl font-bold text-green-600'>
                    ${(analytics?.summary.totalRevenue || 0).toLocaleString()}
                  </p>
                  <p className='text-sm text-muted-foreground'>Revenue</p>
                </div>
              </div>
              {analytics?.data && <AnalyticsChart data={analytics.data} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Collections & Brands Tabs */}
      <Tabs defaultValue='collections' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='collections' className='gap-2'>
            <Layers className='h-4 w-4' />
            Collections ({collections?.length || 0})
          </TabsTrigger>
          <TabsTrigger value='brands' className='gap-2'>
            <Store className='h-4 w-4' />
            Brands ({brands?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value='collections'>
          <Card>
            <CardHeader>
              <CardTitle>Featured Collections</CardTitle>
              <CardDescription>
                Toggle collections to feature them on the trending page.
                Featured collections appear prominently to users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CollectionsTable
                collections={collections || []}
                isLoading={collectionsLoading}
                onToggleFeatured={(id, featured) =>
                  toggleCollectionFeatured.mutate({ id, featured })
                }
                onUpdateRank={(id, rank) => updateCollectionRank.mutate({ id, rank })}
                onPromote={handlePromoteCollection}
                promotingId={promotingId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='brands'>
          <Card>
            <CardHeader>
              <CardTitle>Featured Brands</CardTitle>
              <CardDescription>
                Toggle brands to feature them on the trending page. Featured
                brands get more visibility and engagement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandsTable
                brands={brands || []}
                isLoading={brandsLoading}
                onToggleFeatured={(id, featured) =>
                  toggleBrandFeatured.mutate({ id, featured })
                }
                onUpdateRank={(id, rank) => updateBrandRank.mutate({ id, rank })}
                onPromote={handlePromoteBrand}
                promotingId={promotingId}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Tips */}
      <Card className='border-orange-200 bg-orange-50/50 dark:bg-orange-950/20'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-orange-700 dark:text-orange-400'>
            <Star className='h-5 w-5' />
            Tips for Better Engagement
          </CardTitle>
        </CardHeader>
        <CardContent className='text-sm text-orange-800 dark:text-orange-300 space-y-2'>
          <p>• Feature 5-8 collections for optimal user experience</p>
          <p>• Rotate featured content weekly to keep the page fresh</p>
          <p>• Collections with 10+ products perform better</p>
          <p>
            • Use trending hashtags in collection names for better
            discoverability
          </p>
          <p>
            • Featured brands should have verified status and quality products
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

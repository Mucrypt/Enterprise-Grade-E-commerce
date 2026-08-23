'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService, { CapturedImage } from '@/services/sourcing.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { AlertTriangle, ExternalLink, RefreshCw, X, ChevronLeft, ChevronRight, Star, Plus } from 'lucide-react'

interface SpecRow {
  key: string
  value: string
}

function specsToRows(specs: Record<string, string> | null | undefined): SpecRow[] {
  return Object.entries(specs || {}).map(([key, value]) => ({ key, value }))
}

function rowsToSpecs(rows: SpecRow[]): Record<string, string> {
  const specs: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    specs[key] = row.value
  }
  return specs
}

/**
 * SOURCING-1 -- review/edit view for one captured product, organized the
 * way a founder coming from AutoDS already expects: Content, Images,
 * Specifications and Pricing as separate tabs rather than one long
 * scrolling page. Every editable field is pre-filled from the AI rewrite
 * (or the raw capture if rewriting hasn't run/failed) but can always be
 * overridden by hand. Commit is the one irreversible action -- confirmed
 * via a dialog.
 */
function SourcingDetailPageContent() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const { data, isLoading } = useQuery({
    queryKey: ['sourcing', 'product', id],
    queryFn: () => sourcingService.getSourcedProduct(id),
  })
  const product = data?.product
  const siblingDrafts = data?.siblingDrafts || []

  const [title, setTitle] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [images, setImages] = useState<CapturedImage[]>([])
  const [newImageUrl, setNewImageUrl] = useState('')
  const [specs, setSpecs] = useState<SpecRow[]>([])

  useEffect(() => {
    if (!product) return
    setTitle(product.review_title || product.rewritten_title || product.captured_title || '')
    setDescriptionHtml(product.review_description_html || product.rewritten_description_html || product.captured_description_html || '')
    setCostPrice(product.final_cost_price || product.captured_cost_price_eur || '')
    setSalePrice(product.final_sale_price || product.suggested_sale_price || '')
    setImages(product.review_images && product.review_images.length > 0 ? product.review_images : product.captured_images || [])
    setSpecs(specsToRows(product.review_specs && Object.keys(product.review_specs).length > 0 ? product.review_specs : product.captured_specs))
  }, [product?.id])

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index))
  const moveImage = (index: number, direction: -1 | 1) =>
    setImages((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const setMainImage = (index: number) =>
    setImages((prev) => {
      if (index === 0) return prev
      const next = [...prev]
      const [picked] = next.splice(index, 1)
      next.unshift(picked)
      return next
    })
  const addImageByUrl = () => {
    const url = newImageUrl.trim()
    if (!url) return
    setImages((prev) => [...prev, { url, position: prev.length }])
    setNewImageUrl('')
  }

  const updateSpecKey = (index: number, key: string) => setSpecs((prev) => prev.map((row, i) => (i === index ? { ...row, key } : row)))
  const updateSpecValue = (index: number, value: string) => setSpecs((prev) => prev.map((row, i) => (i === index ? { ...row, value } : row)))
  const removeSpec = (index: number) => setSpecs((prev) => prev.filter((_, i) => i !== index))
  const addSpec = () => setSpecs((prev) => [...prev, { key: '', value: '' }])

  const saveMutation = useMutation({
    mutationFn: () =>
      sourcingService.updateReview(id, {
        reviewTitle: title,
        reviewDescriptionHtml: descriptionHtml,
        reviewImages: images,
        reviewSpecs: rowsToSpecs(specs),
        finalCostPrice: costPrice ? Number(costPrice) : undefined,
        finalSalePrice: salePrice ? Number(salePrice) : undefined,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Saved.')
        queryClient.invalidateQueries({ queryKey: ['sourcing', 'product', id] })
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to save changes.'),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => sourcingService.regenerateRewrite(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Rewrite regenerated -- your own edits above were not touched.')
        queryClient.invalidateQueries({ queryKey: ['sourcing', 'product', id] })
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to regenerate rewrite.'),
  })

  const commitMutation = useMutation({
    mutationFn: () => sourcingService.commitSourcedProduct(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Published as a new product -- it\'s live on the storefront and mobile app now.')
        router.push(`/products/${result.data.productId}/edit`)
      } else {
        toast.error(result.error)
      }
    },
    onError: () => toast.error('Failed to commit product.'),
  })

  const discardMutation = useMutation({
    mutationFn: (reason: string) => sourcingService.discardSourcedProduct(id, reason),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Discarded.')
        router.push('/dashboard/sourcing')
      } else {
        toast.error(result.error)
      }
    },
  })

  if (isLoading || !product) {
    return <Skeleton className='h-96 rounded-lg' />
  }

  const isCommitted = product.status === 'committed'
  const isDiscarded = product.status === 'discarded'
  const lowConfidence = product.rewrite_confidence !== null && product.rewrite_confidence < 60
  const SaveBar = (
    <div className='flex justify-end'>
      <Button variant='outline' onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isCommitted}>
        {saveMutation.isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  )

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight line-clamp-1'>{title || product.captured_title}</h1>
          <a href={product.source_url} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-sm text-muted-foreground hover:underline'>
            View original on {product.source_platform} <ExternalLink className='h-3 w-3' />
          </a>
          {product.captured_supplier_name && (
            <p className='text-sm text-muted-foreground'>Supplier: {product.captured_supplier_name}</p>
          )}
        </div>
        <Badge variant='outline' className='capitalize'>
          {product.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {isCommitted && (
        <Card className='border-green-300 bg-green-50/50 dark:bg-green-950/20'>
          <CardContent className='py-4 text-sm'>
            Already published.{' '}
            {product.committed_product_id ? (
              <a href={`/products/${product.committed_product_id}/edit`} className='underline hover:no-underline'>
                View/edit the live product on the Products page
              </a>
            ) : (
              'View/edit the live product on the Products page.'
            )}
          </CardContent>
        </Card>
      )}

      {product.status === 'rewrite_failed' && (
        <Card className='border-destructive/40 bg-destructive/5'>
          <CardContent className='flex items-center gap-2 py-4 text-sm'>
            <AlertTriangle className='h-4 w-4 text-destructive' /> AI rewrite failed: {product.rewrite_error || 'unknown error'}. You can still
            review/edit/commit using the raw captured text below, or try regenerating.
          </CardContent>
        </Card>
      )}

      {lowConfidence && (
        <Card className='border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'>
          <CardContent className='flex items-center gap-2 py-4 text-sm'>
            <AlertTriangle className='h-4 w-4 text-amber-600' /> The AI rewrite had low confidence ({product.rewrite_confidence}/100)
            {product.rewrite_notes ? ` -- ${product.rewrite_notes}` : ''}. Review carefully before committing.
          </CardContent>
        </Card>
      )}

      {siblingDrafts.length > 0 && (
        <Card className='border-blue-300 bg-blue-50/50 dark:bg-blue-950/20'>
          <CardContent className='flex flex-wrap items-center gap-2 py-4 text-sm'>
            <AlertTriangle className='h-4 w-4 shrink-0 text-blue-600' />
            You have {siblingDrafts.length} other draft{siblingDrafts.length > 1 ? 's' : ''} captured from this same product page --
            probably from re-importing. Make sure you're editing the right one:
            {siblingDrafts.map((s) => (
              <a key={s.id} href={`/dashboard/sourcing/${s.id}`} className='text-blue-600 underline hover:no-underline'>
                {new Date(s.captured_at).toLocaleString()} ({s.status.replace(/_/g, ' ')})
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue='content'>
        <TabsList>
          <TabsTrigger value='content'>Content</TabsTrigger>
          <TabsTrigger value='images'>Images ({images.length})</TabsTrigger>
          <TabsTrigger value='specifications'>Specifications ({specs.length})</TabsTrigger>
          <TabsTrigger value='pricing'>Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value='content' className='space-y-4'>
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Captured (original)</CardTitle>
                <CardDescription>Exactly as read from the source page -- never edited.</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3 text-sm'>
                <p className='font-medium'>{product.captured_title}</p>
                <div
                  className='prose prose-sm max-w-none text-muted-foreground'
                  dangerouslySetInnerHTML={{ __html: product.captured_description_html || '<em>No description captured.</em>' }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between'>
                <div>
                  <CardTitle className='text-base'>Review (editable)</CardTitle>
                  <CardDescription>Pre-filled from the AI rewrite -- edit freely.</CardDescription>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='gap-1.5'
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending || isCommitted}
                >
                  <RefreshCw className='h-3.5 w-3.5' /> {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate rewrite'}
                </Button>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Title' disabled={isCommitted} />
                <Textarea
                  value={descriptionHtml}
                  onChange={(e) => setDescriptionHtml(e.target.value)}
                  placeholder='Description (HTML)'
                  rows={10}
                  disabled={isCommitted}
                />
              </CardContent>
            </Card>
          </div>
          {SaveBar}
        </TabsContent>

        <TabsContent value='images' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Images ({images.length})</CardTitle>
              <CardDescription>
                Use the arrows to reorder, star an image to make it the main product photo, or remove ones you don't want. Committing
                the product hotlinks whatever's left here.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {images.length > 0 ? (
                <div className='grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'>
                  {images.map((img, i) => (
                    <div key={`${img.url}-${i}`} className='group relative'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.altText || ''} className='aspect-square w-full rounded border object-cover' />
                      {i === 0 && (
                        <Badge className='absolute left-1 top-1 gap-1 px-1.5 py-0 text-[10px]'>
                          <Star className='h-2.5 w-2.5 fill-current' /> Main
                        </Badge>
                      )}
                      {!isCommitted && (
                        <div className='absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b bg-black/60 py-0.5 opacity-0 transition-opacity group-hover:opacity-100'>
                          <button
                            type='button'
                            title='Move left'
                            onClick={() => moveImage(i, -1)}
                            disabled={i === 0}
                            className='rounded p-1 text-white hover:bg-white/20 disabled:opacity-30'
                          >
                            <ChevronLeft className='h-3 w-3' />
                          </button>
                          <button
                            type='button'
                            title='Set as main image'
                            onClick={() => setMainImage(i)}
                            disabled={i === 0}
                            className='rounded p-1 text-white hover:bg-white/20 disabled:opacity-30'
                          >
                            <Star className='h-3 w-3' />
                          </button>
                          <button type='button' title='Remove' onClick={() => removeImage(i)} className='rounded p-1 text-white hover:bg-white/20'>
                            <X className='h-3 w-3' />
                          </button>
                          <button
                            type='button'
                            title='Move right'
                            onClick={() => moveImage(i, 1)}
                            disabled={i === images.length - 1}
                            className='rounded p-1 text-white hover:bg-white/20 disabled:opacity-30'
                          >
                            <ChevronRight className='h-3 w-3' />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>No images captured -- add one by URL below.</p>
              )}
              {!isCommitted && (
                <div className='flex gap-2'>
                  <Input
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder='Paste an image URL to add it'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addImageByUrl()
                      }
                    }}
                  />
                  <Button type='button' variant='outline' size='sm' className='gap-1.5 shrink-0' onClick={addImageByUrl}>
                    <Plus className='h-3.5 w-3.5' /> Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {SaveBar}
        </TabsContent>

        <TabsContent value='specifications' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Item specifications ({specs.length})</CardTitle>
              <CardDescription>
                Pre-filled from the source page's "Key attributes" -- edit, remove, or add rows. These are written onto the committed
                product exactly as shown here.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {specs.length === 0 && <p className='text-sm text-muted-foreground'>No specifications yet -- add one below.</p>}
              {specs.map((row, i) => (
                <div key={i} className='flex items-center gap-2'>
                  <Input
                    value={row.key}
                    onChange={(e) => updateSpecKey(i, e.target.value)}
                    placeholder='Attribute (e.g. Material)'
                    disabled={isCommitted}
                    className='w-1/3'
                  />
                  <Input
                    value={row.value}
                    onChange={(e) => updateSpecValue(i, e.target.value)}
                    placeholder='Value (e.g. Aluminum alloy)'
                    disabled={isCommitted}
                  />
                  {!isCommitted && (
                    <Button type='button' variant='ghost' size='icon' className='shrink-0' onClick={() => removeSpec(i)}>
                      <X className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              ))}
              {!isCommitted && (
                <Button type='button' variant='outline' size='sm' className='gap-1.5' onClick={addSpec}>
                  <Plus className='h-3.5 w-3.5' /> Add attribute
                </Button>
              )}
            </CardContent>
          </Card>
          {SaveBar}
        </TabsContent>

        <TabsContent value='pricing' className='space-y-4'>
          {product.captured_price_tiers?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Supplier quantity pricing</CardTitle>
                <CardDescription>The MOQ price breaks as captured from the source page -- unit cost drops at higher order quantities.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                  {product.captured_price_tiers.map((tier, i) => (
                    <div key={i} className='rounded-lg border p-3 text-center'>
                      <p className='text-xs text-muted-foreground'>
                        {tier.minQty}
                        {tier.maxQty ? `–${tier.maxQty}` : '+'} units
                      </p>
                      <p className='text-lg font-semibold'>
                        {tier.price.toFixed(2)} {tier.currency}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Pricing</CardTitle>
              <CardDescription>
                Suggested from your default pricing rule. Cost was converted from {product.captured_currency} to EUR at capture time
                {product.fx_rate_used ? ` (rate ${Number(product.fx_rate_used).toFixed(4)}, ${product.fx_rate_source})` : ' -- conversion failed, enter cost manually'}.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
              <div>
                <label className='text-sm text-muted-foreground'>Cost price (EUR)</label>
                <Input type='number' step='0.01' value={costPrice} onChange={(e) => setCostPrice(e.target.value)} disabled={isCommitted} />
              </div>
              <div>
                <label className='text-sm text-muted-foreground'>Sale price (EUR)</label>
                <Input type='number' step='0.01' value={salePrice} onChange={(e) => setSalePrice(e.target.value)} disabled={isCommitted} />
              </div>
              <div>
                <label className='text-sm text-muted-foreground'>Margin</label>
                <p className='pt-2 text-lg font-semibold'>
                  {costPrice && salePrice && Number(salePrice) > 0
                    ? `${(((Number(salePrice) - Number(costPrice)) / Number(salePrice)) * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          {SaveBar}
        </TabsContent>
      </Tabs>

      {!isCommitted && !isDiscarded && (
        <div className='flex justify-between border-t pt-4'>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='outline' className='text-destructive'>
                Discard
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this sourced product?</AlertDialogTitle>
                <AlertDialogDescription>This removes it from your review queue. It never becomes a product.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => discardMutation.mutate('Discarded by founder')}>Discard</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={commitMutation.isPending}>{commitMutation.isPending ? 'Publishing...' : 'Commit as Product'}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish this as a new TechTools product?</AlertDialogTitle>
                <AlertDialogDescription>
                  Creates a new product using the reviewed title, description, images, and price above -- it goes live on the storefront
                  and mobile app immediately, same as a manually-added product (0 on-hand stock, backorders allowed, since this hasn't
                  shipped to you yet). Save your edits first if you haven't -- this uses whatever was last saved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => commitMutation.mutate()}>Commit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}

export default function SourcingDetailPage() {
  return (
    <RequirePagePermission permission='sourcing.manage'>
      <SourcingDetailPageContent />
    </RequirePagePermission>
  )
}

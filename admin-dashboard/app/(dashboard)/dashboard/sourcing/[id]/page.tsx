'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RequirePagePermission } from '@/components/auth/RequirePagePermission'
import sourcingService from '@/services/sourcing.service'
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
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'

/**
 * SOURCING-1 -- review/edit view for one captured product. Content tab
 * shows the raw captured text side-by-side with the AI rewrite (once
 * ready) and lets the founder override either. Pricing tab shows the
 * suggested price and lets the founder confirm/edit it. Commit is the
 * one irreversible action -- confirmed via a dialog.
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

  const [title, setTitle] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')

  useEffect(() => {
    if (!product) return
    setTitle(product.review_title || product.rewritten_title || product.captured_title || '')
    setDescriptionHtml(product.review_description_html || product.rewritten_description_html || product.captured_description_html || '')
    setCostPrice(product.final_cost_price || product.captured_cost_price_eur || '')
    setSalePrice(product.final_sale_price || product.suggested_sale_price || '')
  }, [product?.id])

  const saveMutation = useMutation({
    mutationFn: () =>
      sourcingService.updateReview(id, {
        reviewTitle: title,
        reviewDescriptionHtml: descriptionHtml,
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
        toast.success('Published as a new product (inactive by default -- activate it from the Products page when ready).')
        router.push(`/dashboard/products/${result.data.productId}/edit`)
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

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight line-clamp-1'>{title || product.captured_title}</h1>
          <a href={product.source_url} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-sm text-muted-foreground hover:underline'>
            View original on {product.source_platform} <ExternalLink className='h-3 w-3' />
          </a>
        </div>
        <Badge variant='outline' className='capitalize'>
          {product.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {isCommitted && (
        <Card className='border-green-300 bg-green-50/50 dark:bg-green-950/20'>
          <CardContent className='py-4 text-sm'>
            Already published. View/edit the live product on the Products page.
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

      <Tabs defaultValue='content'>
        <TabsList>
          <TabsTrigger value='content'>Content</TabsTrigger>
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
                <div className='prose prose-sm max-w-none text-muted-foreground' dangerouslySetInnerHTML={{ __html: product.captured_description_html || '<em>No description captured.</em>' }} />
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

          {product.captured_images?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Images ({product.captured_images.length})</CardTitle>
                <CardDescription>Hotlinked from the source -- committing the product uses these URLs directly.</CardDescription>
              </CardHeader>
              <CardContent className='flex flex-wrap gap-3'>
                {product.captured_images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img.url} alt={img.altText || ''} className='h-20 w-20 rounded border object-cover' />
                ))}
              </CardContent>
            </Card>
          )}

          <div className='flex justify-end'>
            <Button variant='outline' onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isCommitted}>
              {saveMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value='pricing' className='space-y-4'>
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
          <div className='flex justify-end'>
            <Button variant='outline' onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isCommitted}>
              {saveMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
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
                  Creates a new product (starting inactive, with 0 stock and backorders allowed) using the reviewed title, description,
                  images, and price above. Save your edits first if you haven't -- this uses whatever was last saved.
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

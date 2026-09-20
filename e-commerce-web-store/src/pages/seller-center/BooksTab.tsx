// Books are a distinct product line from store products (creator_profile_id
// vs seller_profile_id) -- explicitly labeled as such here rather than
// presented as the seller's whole business, which is what made the old
// dashboard's top-level "Catalog growth"/"30-day revenue" tiles read as
// broken for store-only sellers.

import { useState, useEffect } from 'react'
import { BarChart3, BookOpen, CheckCircle2, DollarSign, Loader2, Package } from 'lucide-react'
import { creatorApi } from '../../api'
import type { CreatorBookDraftInput, CreatorDashboardMetrics, CreatorProduct } from '../../types'
import { formatPrice } from '../../utils'
import MessageBanner from './MessageBanner'

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function BooksTab() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<CreatorDashboardMetrics | null>(null)
  const [products, setProducts] = useState<CreatorProduct[]>([])
  const [productsPage, setProductsPage] = useState(1)
  const [productsHasMore, setProductsHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [drafts, setDrafts] = useState<
    Record<string, { basePrice: string; salePrice: string; shortDescription: string }>
  >({})
  const [isSavingId, setIsSavingId] = useState<string | null>(null)

  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [latestBookId, setLatestBookId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [bookForm, setBookForm] = useState<CreatorBookDraftInput>({
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    basePrice: 9.99,
    salePrice: 0,
    format: 'pdf',
    fileUrl: '',
    previewUrl: '',
    coverImageUrl: '',
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [metricsResult, productsResult] = await Promise.all([
        creatorApi.getDashboardMetrics().catch(() => null),
        creatorApi.getMyProducts({ page: 1, limit: 8 }).catch(() => ({
          items: [],
          pagination: { page: 1, limit: 8, hasMore: false },
        })),
      ])
      setMetrics(metricsResult)
      setProducts(productsResult.items)
      setProductsPage(productsResult.pagination?.page ?? 1)
      setProductsHasMore(productsResult.pagination?.hasMore ?? false)
      setDrafts(() => {
        const next: typeof drafts = {}
        for (const product of productsResult.items) {
          next[product.id] = {
            basePrice: String(product.basePrice ?? ''),
            salePrice: product.salePrice === null || product.salePrice === undefined ? '' : String(product.salePrice),
            shortDescription: product.shortDescription || '',
          }
        }
        return next
      })
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateBook = async () => {
    setError('')
    setSuccess('')
    setIsCreating(true)
    try {
      const payload: CreatorBookDraftInput = {
        name: bookForm.name.trim(),
        slug: toSlug(bookForm.slug || bookForm.name),
        description: bookForm.description?.trim(),
        shortDescription: bookForm.shortDescription?.trim(),
        basePrice: Number(bookForm.basePrice || 0),
        salePrice: Number(bookForm.salePrice || 0) || undefined,
        format: bookForm.format,
        fileUrl: bookForm.fileUrl?.trim() || undefined,
        previewUrl: bookForm.previewUrl?.trim() || undefined,
        coverImageUrl: bookForm.coverImageUrl?.trim() || undefined,
      }
      const created = await creatorApi.createBook(payload)
      setLatestBookId(created.id)
      setSuccess('Book draft created successfully. Submit it for review when ready.')
    } catch (createError: any) {
      setError(createError?.response?.data?.error || 'Could not create book draft.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSubmitLatestBook = async () => {
    if (!latestBookId) return
    setError('')
    setSuccess('')
    setIsSubmitting(true)
    try {
      await creatorApi.submitBookForReview(latestBookId, { notes: 'Submitted from creator dashboard' })
      setSuccess('Book submitted for review successfully.')
    } catch (submitError: any) {
      setError(
        submitError?.response?.data?.error ||
          'Could not submit this book yet. Make sure a full file URL is provided.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoadMoreProducts = async () => {
    if (!productsHasMore || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = productsPage + 1
      const result = await creatorApi.getMyProducts({ page: nextPage, limit: 8 })
      setProducts((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        return [...current, ...result.items.filter((item) => !existingIds.has(item.id))]
      })
      setDrafts((current) => {
        const next = { ...current }
        for (const product of result.items) {
          if (!next[product.id]) {
            next[product.id] = {
              basePrice: String(product.basePrice ?? ''),
              salePrice: product.salePrice === null || product.salePrice === undefined ? '' : String(product.salePrice),
              shortDescription: product.shortDescription || '',
            }
          }
        }
        return next
      })
      setProductsPage(result.pagination?.page ?? nextPage)
      setProductsHasMore(result.pagination?.hasMore ?? false)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleSaveProduct = async (productId: string) => {
    const draft = drafts[productId]
    if (!draft) return
    setError('')
    setSuccess('')
    setIsSavingId(productId)
    try {
      const updated = await creatorApi.updateMyProduct(productId, {
        basePrice: Number(draft.basePrice || 0),
        salePrice: draft.salePrice.trim() === '' ? null : Number(draft.salePrice || 0),
        shortDescription: draft.shortDescription.trim(),
      })
      setProducts((current) => current.map((item) => (item.id === productId ? updated : item)))
      setSuccess('Book updated successfully.')
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || 'Could not update this book right now.')
    } finally {
      setIsSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center rounded-3xl bg-white py-16 shadow-sm ring-1 ring-black/5'>
        <Loader2 className='h-6 w-6 animate-spin text-orange-500' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <MessageBanner error={error} success={success} />

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <BookOpen className='h-5 w-5 text-blue-600' /> Create and launch a book
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          Digital books are a separate product line from your store products.
        </p>

        <div className='mt-5 grid gap-4 md:grid-cols-2'>
          <input
            value={bookForm.name}
            onChange={(e) => setBookForm((current) => ({ ...current, name: e.target.value }))}
            placeholder='Book title'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <input
            value={bookForm.slug || ''}
            onChange={(e) => setBookForm((current) => ({ ...current, slug: e.target.value }))}
            placeholder='Slug (optional)'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <input
            type='number'
            min='0'
            step='0.01'
            value={bookForm.basePrice}
            onChange={(e) => setBookForm((current) => ({ ...current, basePrice: Number(e.target.value || 0) }))}
            placeholder='Base price'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <input
            type='number'
            min='0'
            step='0.01'
            value={bookForm.salePrice || 0}
            onChange={(e) => setBookForm((current) => ({ ...current, salePrice: Number(e.target.value || 0) }))}
            placeholder='Sale price (optional)'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <input
            value={bookForm.fileUrl || ''}
            onChange={(e) => setBookForm((current) => ({ ...current, fileUrl: e.target.value }))}
            placeholder='Full book file URL (required before submit)'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
          />
          <input
            value={bookForm.previewUrl || ''}
            onChange={(e) => setBookForm((current) => ({ ...current, previewUrl: e.target.value }))}
            placeholder='Preview URL (optional)'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <input
            value={bookForm.coverImageUrl || ''}
            onChange={(e) => setBookForm((current) => ({ ...current, coverImageUrl: e.target.value }))}
            placeholder='Cover image URL (optional)'
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
          />
          <textarea
            value={bookForm.shortDescription || ''}
            onChange={(e) => setBookForm((current) => ({ ...current, shortDescription: e.target.value }))}
            placeholder='Short description'
            rows={2}
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
          />
          <textarea
            value={bookForm.description || ''}
            onChange={(e) => setBookForm((current) => ({ ...current, description: e.target.value }))}
            placeholder='Long description'
            rows={4}
            className='w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:col-span-2'
          />
        </div>

        <div className='mt-5 flex flex-wrap gap-3'>
          <button
            type='button'
            onClick={handleCreateBook}
            disabled={isCreating || !bookForm.name.trim() || !bookForm.basePrice}
            className='inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isCreating ? <Loader2 className='h-4 w-4 animate-spin' /> : <CheckCircle2 className='h-4 w-4' />}
            {isCreating ? 'Creating...' : 'Create draft book'}
          </button>
          <button
            type='button'
            onClick={handleSubmitLatestBook}
            disabled={isSubmitting || !latestBookId}
            className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <BarChart3 className='h-4 w-4' />}
            {isSubmitting ? 'Submitting...' : 'Submit latest draft for review'}
          </button>
        </div>
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <div className='flex items-start justify-between gap-4'>
          <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
            <Package className='h-5 w-5 text-blue-600' /> Manage your books
          </h2>
          <span className='rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 ring-1 ring-slate-100'>
            {products.length} loaded
          </span>
        </div>

        <div className='mt-5 space-y-4'>
          {products.length > 0 ? (
            products.map((product) => (
              <div key={product.id} className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
                <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='font-semibold text-slate-900'>{product.name}</p>
                    <p className='text-xs text-gray-500'>
                      /{product.slug} &middot; {product.publicationStatus}
                    </p>
                  </div>
                  <p className='text-xs font-medium text-gray-500'>Sold: {product.totalUnitsSold}</p>
                </div>

                <div className='mt-3 grid gap-3 md:grid-cols-3'>
                  <input
                    value={drafts[product.id]?.basePrice ?? ''}
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { basePrice: '', salePrice: '', shortDescription: '' }),
                          basePrice: e.target.value,
                        },
                      }))
                    }
                    type='number'
                    min='0'
                    step='0.01'
                    placeholder='Base price'
                    className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                  />
                  <input
                    value={drafts[product.id]?.salePrice ?? ''}
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [product.id]: {
                          ...(current[product.id] || { basePrice: '', salePrice: '', shortDescription: '' }),
                          salePrice: e.target.value,
                        },
                      }))
                    }
                    type='number'
                    min='0'
                    step='0.01'
                    placeholder='Sale price (optional)'
                    className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                  />
                  <button
                    type='button'
                    onClick={() => handleSaveProduct(product.id)}
                    disabled={isSavingId === product.id}
                    className='inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {isSavingId === product.id ? (
                      <>
                        <Loader2 className='h-4 w-4 animate-spin' /> Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>

                <textarea
                  value={drafts[product.id]?.shortDescription ?? ''}
                  onChange={(e) =>
                    setDrafts((current) => ({
                      ...current,
                      [product.id]: {
                        ...(current[product.id] || { basePrice: '', salePrice: '', shortDescription: '' }),
                        shortDescription: e.target.value,
                      },
                    }))
                  }
                  rows={2}
                  placeholder='Short description'
                  className='mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
                />
              </div>
            ))
          ) : (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500'>
              No books yet. Create your first draft above.
            </div>
          )}
        </div>

        {productsHasMore ? (
          <div className='mt-5'>
            <button
              type='button'
              onClick={handleLoadMoreProducts}
              disabled={isLoadingMore}
              className='inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' /> Loading more
                </>
              ) : (
                'Load more books'
              )}
            </button>
          </div>
        ) : null}
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <DollarSign className='h-5 w-5 text-emerald-600' /> Book revenue
        </h2>
        <div className='mt-4 space-y-4 text-sm text-gray-700'>
          <div className='flex items-center justify-between gap-3'>
            <span>Gross sales</span>
            <span className='font-semibold text-slate-900'>{formatPrice(metrics?.sales.grossSales || 0)}</span>
          </div>
          <div className='flex items-center justify-between gap-3'>
            <span>Paid orders</span>
            <span className='font-semibold text-slate-900'>{metrics?.sales.paidOrders ?? 0}</span>
          </div>
          <div className='flex items-center justify-between gap-3'>
            <span>Units sold</span>
            <span className='font-semibold text-slate-900'>{metrics?.sales.unitsSold ?? 0}</span>
          </div>
          <div className='flex items-center justify-between gap-3'>
            <span>Time to first sale</span>
            <span className='font-semibold text-slate-900'>
              {metrics?.sales.timeToFirstSaleHours != null ? `${metrics.sales.timeToFirstSaleHours}h` : 'Not yet'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Loader2, Package, Store, Trash2 } from 'lucide-react'
import { categoriesApi, sellerProductsApi, type SellerProduct } from '../../api'
import type { Category } from '../../types'
import { formatPrice } from '../../utils'
import MessageBanner from './MessageBanner'

export default function StoreProductsTab() {
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      setProducts(await sellerProductsApi.getMine())
    } catch {
      // Soft failure -- the rest of the tab still works.
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
    categoriesApi.getAll().then(setCategories).catch(() => setCategories([]))
  }, [])

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrice('')
    setStock('0')
    setCategoryId('')
    setImages([])
    setFormError('')
  }

  const handleCreate = async () => {
    setFormError('')
    if (!name.trim()) return setFormError('Give the product a name.')
    if (!categoryId) return setFormError('Choose a category.')
    const numericPrice = Number(price)
    if (!numericPrice || numericPrice <= 0) return setFormError('Enter a real price.')

    setIsSaving(true)
    try {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      const sku = `SLR-${Date.now().toString(36).toUpperCase()}`

      const formData = new FormData()
      formData.append('sku', sku)
      formData.append('name', name)
      formData.append('slug', slug)
      formData.append('description', description)
      formData.append('categoryId', categoryId)
      formData.append('basePrice', String(numericPrice))
      formData.append('stockQuantity', String(Number(stock) || 0))
      images.forEach((file) => formData.append('images', file))

      await sellerProductsApi.createMine(formData)
      resetForm()
      await loadProducts()
      setSuccess('Product submitted -- it will be visible to shoppers once an admin approves it.')
    } catch (createError: any) {
      setFormError(createError?.response?.data?.message || 'Could not create the product right now.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (productId: string) => {
    try {
      await sellerProductsApi.deleteMine(productId)
      setProducts((current) => current.filter((p) => p.id !== productId))
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Could not delete the product right now.')
    }
  }

  return (
    <div className='space-y-6'>
      <MessageBanner error={error} success={success} />

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
          <Store className='h-5 w-5 text-orange-600' /> List a product
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          Your own real product -- every listing goes pending an admin&apos;s approval before
          it&apos;s visible or purchasable. Your seller tier caps how many active listings you can
          have and the maximum price.
        </p>

        <div className='mt-5 grid gap-3 md:grid-cols-2'>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Product name'
            className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
          >
            <option value=''>Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type='number'
            min='0'
            step='0.01'
            placeholder='Price'
            className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
          />
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            type='number'
            min='0'
            step='1'
            placeholder='Stock quantity'
            className='w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder='Description'
          className='mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'
        />

        <label className='mt-3 flex flex-col gap-1 text-xs font-medium text-gray-500'>
          Images
          <input
            type='file'
            accept='image/*'
            multiple
            onChange={(e) => setImages(Array.from(e.target.files || []).slice(0, 10))}
            className='rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white'
          />
        </label>

        {formError && <p className='mt-3 text-sm font-medium text-red-600'>{formError}</p>}

        <button
          type='button'
          onClick={handleCreate}
          disabled={isSaving}
          className='mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isSaving ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' /> Submitting...
            </>
          ) : (
            'Submit for review'
          )}
        </button>
      </div>

      <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5'>
        <div className='flex items-center justify-between gap-4'>
          <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900'>
            <Package className='h-5 w-5 text-orange-600' /> Your products
          </h2>
          <span className='rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 ring-1 ring-slate-100'>
            {products.length} total
          </span>
        </div>

        <div className='mt-5 space-y-4'>
          {productsLoading ? (
            <div className='flex items-center gap-2 text-sm text-gray-500'>
              <Loader2 className='h-4 w-4 animate-spin' /> Loading your products...
            </div>
          ) : products.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500'>
              No products yet -- list your first one above.
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className='rounded-2xl border border-gray-100 bg-slate-50 p-4'>
                <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='font-semibold text-slate-900'>{product.name}</p>
                    <p className='text-xs text-gray-500'>
                      /{product.slug} -- {formatPrice(Number(product.sale_price ?? product.base_price))} -- stock:{' '}
                      {product.total_stock ?? 0}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                        product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {product.is_active ? 'Live' : 'Pending review'}
                    </span>
                    <button
                      type='button'
                      onClick={() => handleDelete(product.id)}
                      className='inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-slate-200 transition hover:bg-red-50'
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
